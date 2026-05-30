package com.example

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

class BiometricHelper(private val activity: FragmentActivity, private val webView: WebView) {

    @JavascriptInterface
    fun authenticate() {
        Handler(Looper.getMainLooper()).post {
            try {
                val executor = ContextCompat.getMainExecutor(activity)
                val biometricPrompt = BiometricPrompt(activity, executor,
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            super.onAuthenticationError(errorCode, errString)
                            notifyLog("Auth Error: $errorCode - $errString")
                            notifyJS("error")
                        }

                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            super.onAuthenticationSucceeded(result)
                            notifyLog("Auth Succeeded")
                            notifyJS("success")
                        }

                        override fun onAuthenticationFailed() {
                            super.onAuthenticationFailed()
                            notifyLog("Auth Failed")
                            notifyJS("failed")
                        }
                    })

                val promptInfo = BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Login Biometrik")
                    .setSubtitle("Gunakan Sidik Jari, Wajah, atau PIN perangkat")
                    .setDescription("Verifikasi identitas Anda")
                    .setAllowedAuthenticators(androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK or androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                    .build()

                biometricPrompt.authenticate(promptInfo)
            } catch (e: Exception) {
                e.printStackTrace()
                notifyLog("Crash Exception: " + e.message)
                notifyJS("error")
            }
        }
    }

    private fun notifyLog(msg: String) {
        Handler(Looper.getMainLooper()).post {
            webView.evaluateJavascript("console.log('BiometricHelper:', '${msg.replace("'", "\\'")}')", null)
        }
    }

    private fun notifyJS(result: String) {
        Handler(Looper.getMainLooper()).post {
            webView.evaluateJavascript("window.onBiometricResult('$result')", null)
        }
    }
}
