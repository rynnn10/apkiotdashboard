package com.example

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import android.webkit.WebSettings
import androidx.activity.compose.BackHandler

import androidx.biometric.BiometricPrompt
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.example.ui.theme.MyApplicationTheme

import android.os.Build

class AndroidAppInterface(private val activity: FragmentActivity) {
    @android.webkit.JavascriptInterface
    fun exitApp() {
        activity.runOnUiThread {
            activity.finish()
        }
    }
    @android.webkit.JavascriptInterface
    fun setAutoLogin(enabled: Boolean) {
        activity.getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
            .edit().putBoolean("auto_login", enabled).apply()
    }
@android.webkit.JavascriptInterface
    fun setPrayerAlarm(type: String, timeInMillis: Long) {
        try {
            val alarmManager = activity.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
            val intent = android.content.Intent(activity, PrayerAlarmReceiver::class.java).apply {
                putExtra("ALARM_TYPE", type)
            }
            val pendingIntent = android.app.PendingIntent.getBroadcast(
                activity, type.hashCode(), intent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
            )
            // Tembak alarm langsung ke sistem inti HP
            alarmManager.setExactAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, timeInMillis, pendingIntent)
        } catch (e: SecurityException) {
            e.printStackTrace()
        }
    }

    @android.webkit.JavascriptInterface
    fun cancelPrayerAlarm(type: String) {
        val alarmManager = activity.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
        val intent = android.content.Intent(activity, PrayerAlarmReceiver::class.java)
        val pendingIntent = android.app.PendingIntent.getBroadcast(
            activity, type.hashCode(), intent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(pendingIntent)
    }
    @android.webkit.JavascriptInterface
    fun showSystemNotification(title: String, message: String) {
        val channelId = "GENERAL_CHANNEL"
        val notificationManager = activity.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val channel = android.app.NotificationChannel(channelId, "Informasi Sistem", android.app.NotificationManager.IMPORTANCE_DEFAULT)
            notificationManager.createNotificationChannel(channel)
        }

        val notification = androidx.core.app.NotificationCompat.Builder(activity, channelId)
            .setSmallIcon(R.drawable.ic_notification) // Menggunakan logo putih milikmu
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(androidx.core.app.NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()
            
        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }
}

class MainActivity : FragmentActivity() {

    override fun attachBaseContext(newBase: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            super.attachBaseContext(newBase.createAttributionContext("webview"))
        } else {
            super.attachBaseContext(newBase)
        }
    }

    private var permissionsGranted by mutableStateOf(false)
    private var isUnlocked by mutableStateOf(false)

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        permissionsGranted = true // Show webview whether granted or not, but we waited for the dialog
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        isUnlocked = getSharedPreferences("app_prefs", Context.MODE_PRIVATE).getBoolean("auto_login", false)

// 1. Daftar izin dasar
        val permissionsList = mutableListOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )

        // 2. Tambahkan izin Notifikasi khusus jika HP menggunakan Android 13 ke atas
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionsList.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val permissionsToRequest = permissionsList.toTypedArray()

        val hasAllPermissions = permissionsToRequest.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }

        if (hasAllPermissions) {
            permissionsGranted = true
        } else {
            requestPermissionLauncher.launch(permissionsToRequest)
        }

        enableEdgeToEdge()
        setContent {
            MyApplicationTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    if (!isUnlocked) {
                        NativeLockScreen(
                            activity = this@MainActivity,
                            onUnlock = {
                                isUnlocked = true
                            }
                        )
                    } else if (permissionsGranted) {
                        WebViewScreen(this@MainActivity)
                    }
                }
            }
        }
    }
}

@Composable
fun NativeLockScreen(activity: FragmentActivity, onUnlock: () -> Unit) {
    var pin by remember { mutableStateOf("") }
    val correctPin = "121232"
    var isRememberMe by remember { mutableStateOf(false) }

    val tryBiometric = {
        val executor = ContextCompat.getMainExecutor(activity)
        val biometricPrompt = BiometricPrompt(activity, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    if (isRememberMe) {
                        activity.getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
                            .edit().putBoolean("auto_login", true).apply()
                    }
                    onUnlock()
                }
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {}
                override fun onAuthenticationFailed() {}
            })
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Login Biometrik")
            .setSubtitle("Gunakan Sidik Jari, Wajah, atau PIN perangkat")
            .setAllowedAuthenticators(androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK or androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL)
            .build()
        try { biometricPrompt.authenticate(promptInfo) } catch (e: Exception) {}
    }

    Column(
        modifier = Modifier.fillMaxSize().background(Color(0xFF0F172A)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(Icons.Filled.Lock, contentDescription = "Lock", tint = Color(0xFF10B981), modifier = Modifier.size(64.dp))
        Spacer(modifier = Modifier.height(16.dp))
        Text("LOCKED", color = Color.White, fontSize = 24.sp)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Masukkan PIN Keamanan", color = Color.LightGray)
        Spacer(modifier = Modifier.height(24.dp))

        Row {
            for (i in 0 until 6) {
                Box(modifier = Modifier.size(24.dp).padding(4.dp).background(
                    if (i < pin.length) Color.White else Color.Transparent, 
                    CircleShape
                ).border(2.dp, Color.Gray, CircleShape))
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        val pad = listOf(
            listOf("1", "2", "3"),
            listOf("4", "5", "6"),
            listOf("7", "8", "9"),
            listOf("DEL", "0", "BIO")
        )

        pad.forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(24.dp), modifier = Modifier.padding(bottom = 16.dp)) {
                row.forEach { btn ->
                    Button(
                        onClick = {
                            if (btn == "DEL") {
                                if (pin.isNotEmpty()) pin = pin.dropLast(1)
                            } else if (btn == "BIO") {
                                tryBiometric()
                            } else {
                                if (pin.length < 6) pin += btn
                                if (pin == correctPin) {
                                    if (isRememberMe) {
                                        activity.getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
                                            .edit().putBoolean("auto_login", true).apply()
                                    }
                                    onUnlock()
                                }
                            }
                        },
                        modifier = Modifier.size(72.dp),
                        shape = CircleShape,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B)),
                        contentPadding = PaddingValues(0.dp)
                    ) {
                        if (btn == "DEL") Icon(Icons.Filled.Clear, contentDescription = "Del", tint = Color.Red)
                        else if (btn == "BIO") Icon(Icons.Filled.Lock, contentDescription = "Bio", tint = Color.Green, modifier = Modifier.size(32.dp))
                        else Text(btn, fontSize = 24.sp, color = Color.White)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = isRememberMe, onCheckedChange = { isRememberMe = it })
            Text("Ingat Saya (Auto Login)", color = Color.LightGray)
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebViewScreen(activity: FragmentActivity) {
    var showExitDialog by remember { mutableStateOf(false) }

    if (showExitDialog) {
        AlertDialog(
            onDismissRequest = { showExitDialog = false },
            title = { Text("Keluar Aplikasi?") },
            text = { Text("Sistem akan dimatikan dan koneksi sensor diputus.") },
            confirmButton = {
                Button(
                    onClick = { activity.finish() },
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Red)
                ) {
                    Text("Matikan")
                }
            },
            dismissButton = {
                TextButton(onClick = { showExitDialog = false }) {
                    Text("Batal")
                }
            }
        )
    }

    BackHandler {
        showExitDialog = true
    }

    AndroidView(
        modifier = Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing),
        factory = { context ->
            WebView(context).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    mediaPlaybackRequiresUserGesture = false
                    allowFileAccess = true
                    @Suppress("DEPRECATION")
                    allowFileAccessFromFileURLs = true
                    @Suppress("DEPRECATION")
                    allowUniversalAccessFromFileURLs = true
                    allowContentAccess = true
                    setGeolocationEnabled(true)
                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                }
                addJavascriptInterface(AndroidAppInterface(activity), "AndroidApp")
                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                        return false
                    }
                    private var pageLoaded = false
                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        if (!pageLoaded && url?.contains("index.html") == true) {
                            pageLoaded = true
                            
                            val autoLogin = activity.getSharedPreferences("app_prefs", Context.MODE_PRIVATE).getBoolean("auto_login", false)
                            val tokenScript = if(autoLogin) {
                                "localStorage.setItem('my_trusted_device_token', 'DEVICE_RIYAN_TERVERIFIKASI_2026');"
                            } else {
                                "localStorage.removeItem('my_trusted_device_token');"
                            }

                            view?.evaluateJavascript(
                                tokenScript + " if(typeof unlockApp === 'function'){unlockApp(true);}", 
                                null
                            )
                        }
                    }
                }
                webChromeClient = object : WebChromeClient() {
                    override fun onPermissionRequest(request: PermissionRequest) {
                        request.grant(request.resources)
                    }
                    override fun onGeolocationPermissionsShowPrompt(
                        origin: String?,
                        callback: GeolocationPermissions.Callback?
                    ) {
                        callback?.invoke(origin, true, false)
                    }
                }
                loadUrl("file:///android_asset/www/index.html")
            }
        },
        update = {}
    )
}
