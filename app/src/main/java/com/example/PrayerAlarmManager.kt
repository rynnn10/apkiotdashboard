package com.example // Pastikan tulisan ini sesuai dengan packagemu!

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.MediaPlayer
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class PrayerAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val type = intent.getStringExtra("ALARM_TYPE") ?: return
        val serviceIntent = Intent(context, AudioService::class.java).apply {
            putExtra("ALARM_TYPE", type)
        }
        context.startService(serviceIntent)
    }
}

class AudioService : Service() {
    private var mediaPlayer: MediaPlayer? = null
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val type = intent?.getStringExtra("ALARM_TYPE") ?: return START_NOT_STICKY
        val fileName = if (type.equals("imsak", true)) "www/imsak.mp3" else "www/adzan.mp3"
        
        // ---> PANGGIL FUNGSI NOTIFIKASI DI SINI <---
        tampilkanNotifikasi(type)

        try {
            val afd = applicationContext.assets.openFd(fileName)
            mediaPlayer = MediaPlayer().apply {
                setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                prepare()
                start()
                setOnCompletionListener { stopSelf() }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun tampilkanNotifikasi(type: String) {
        val channelId = "AZAN_CHANNEL"
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        // Wajib membuat Channel untuk Android 8.0 (Oreo) ke atas
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId, 
                "Jadwal Sholat", 
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifikasi waktu sholat dan imsak"
            }
            notificationManager.createNotificationChannel(channel)
        }

        val title = if (type.equals("imsak", true)) "Waktu Imsak" else "Waktu $type"
        val text = if (type.equals("imsak", true)) "Waktu imsak telah tiba." else "Waktu sholat $type telah tiba, mari dirikan sholat."
        
        // Agar ketika notifikasi diklik, ia membuka aplikasimu
        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            this.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, openAppIntent, 
            PendingIntent.FLAG_IMMUTABLE
        )

        // Merakit tampilan notifikasi
        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_HIGH) // Agar muncul melayang (Heads-up)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()
        
        // Tembakkan notifikasi ke layar!
        notificationManager.notify(type.hashCode(), notification)
    }

    override fun onBind(intent: Intent?): IBinder? = null
    
    override fun onDestroy() {
        mediaPlayer?.release()
        super.onDestroy()
    }
}