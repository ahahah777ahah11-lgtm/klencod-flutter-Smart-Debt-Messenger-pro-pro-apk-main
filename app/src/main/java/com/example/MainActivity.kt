package com.example

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.FileProvider
import com.example.ui.theme.MyApplicationTheme
import java.io.File
import java.io.FileOutputStream

class MainActivity : ComponentActivity() {

  private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
  private var currentWebView: WebView? = null

  private val fileChooserLauncher =
      registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
          val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
          fileChooserCallback?.onReceiveValue(uris)
        } else {
          fileChooserCallback?.onReceiveValue(null)
        }
        fileChooserCallback = null
      }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()

    setContent {
      MyApplicationTheme {
        var canGoBack by remember { mutableStateOf(false) }

        BackHandler(enabled = canGoBack) {
          currentWebView?.let { webView ->
            if (webView.canGoBack()) {
              webView.goBack()
            }
          }
        }

        Surface(
            modifier = Modifier.fillMaxSize().systemBarsPadding(),
            color = Color(0xFF103B59)
        ) {
          DebtManagerWebView(
              onWebViewCreated = { webView ->
                currentWebView = webView
              },
              onCanGoBackChanged = { canBack ->
                canGoBack = canBack
              },
              onShowFileChooser = { filePathCallback, fileChooserParams ->
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback
                try {
                  val intent = fileChooserParams?.createIntent()
                      ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                        type = "*/*"
                        addCategory(Intent.CATEGORY_OPENABLE)
                      }
                  fileChooserLauncher.launch(intent)
                } catch (e: Exception) {
                  fileChooserCallback?.onReceiveValue(null)
                  fileChooserCallback = null
                }
              }
          )
        }
      }
    }
  }

  @SuppressLint("SetJavaScriptEnabled")
  @Composable
  private fun DebtManagerWebView(
      onWebViewCreated: (WebView) -> Unit,
      onCanGoBackChanged: (Boolean) -> Unit,
      onShowFileChooser: (ValueCallback<Array<Uri>>, WebChromeClient.FileChooserParams?) -> Unit
  ) {
    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { context ->
          WebView(context).apply {
            onWebViewCreated(this)

            settings.apply {
              javaScriptEnabled = true
              domStorageEnabled = true
              databaseEnabled = true
              allowFileAccess = true
              allowContentAccess = true
              loadWithOverviewMode = true
              useWideViewPort = true
              cacheMode = WebSettings.LOAD_DEFAULT
              displayZoomControls = false
              builtInZoomControls = false
            }

            addJavascriptInterface(
                AndroidNativeBridge(context),
                "AndroidNativeBridge"
            )

            webViewClient = object : WebViewClient() {
              override fun shouldOverrideUrlLoading(
                  view: WebView?,
                  request: WebResourceRequest?
              ): Boolean {
                val url = request?.url?.toString() ?: return false
                return handleSpecialUrl(context, url)
              }

              @Deprecated("Deprecated in Java")
              override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                if (url == null) return false
                return handleSpecialUrl(context, url)
              }

              override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                onCanGoBackChanged(canGoBack())
              }
            }

            webChromeClient = object : WebChromeClient() {
              override fun onShowFileChooser(
                  webView: WebView?,
                  filePathCallback: ValueCallback<Array<Uri>>?,
                  fileChooserParams: FileChooserParams?
              ): Boolean {
                if (filePathCallback != null) {
                  onShowFileChooser(filePathCallback, fileChooserParams)
                  return true
                }
                return false
              }
            }

            loadUrl("file:///android_asset/smart-debt/index.html")
          }
        }
    )
  }

  private fun handleSpecialUrl(context: Context, url: String): Boolean {
    try {
      when {
        url.startsWith("sms:") || url.startsWith("smsto:") -> {
          val intent = Intent(Intent.ACTION_SENDTO, Uri.parse(url))
          context.startActivity(intent)
          return true
        }
        url.startsWith("tel:") -> {
          val intent = Intent(Intent.ACTION_DIAL, Uri.parse(url))
          context.startActivity(intent)
          return true
        }
        url.startsWith("mailto:") -> {
          val intent = Intent(Intent.ACTION_SENDTO, Uri.parse(url))
          context.startActivity(intent)
          return true
        }
      }
    } catch (e: Exception) {
      Toast.makeText(context, "تعذر فتح التطبيق المطلوب: ${e.message}", Toast.LENGTH_SHORT).show()
      return true
    }
    return false
  }

  inner class AndroidNativeBridge(private val context: Context) {

    @JavascriptInterface
    fun isAndroidApp(): Boolean = true

    @JavascriptInterface
    fun openSmsApp(phoneNumber: String, messageText: String) {
      try {
        val cleanPhone = phoneNumber.replace(Regex("[^0-9+]"), "")
        val intent = Intent(Intent.ACTION_SENDTO).apply {
          data = Uri.parse("smsto:$cleanPhone")
          putExtra("sms_body", messageText)
          putExtra(Intent.EXTRA_TEXT, messageText)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
      } catch (e: Exception) {
        runOnUiThread {
          Toast.makeText(context, "تعذر فتح تطبيق الرسائل: ${e.message}", Toast.LENGTH_LONG).show()
        }
      }
    }

    @JavascriptInterface
    fun shareText(title: String, content: String) {
      try {
        val intent = Intent(Intent.ACTION_SEND).apply {
          type = "text/plain"
          putExtra(Intent.EXTRA_SUBJECT, title)
          putExtra(Intent.EXTRA_TEXT, content)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        val chooser = Intent.createChooser(intent, title).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(chooser)
      } catch (e: Exception) {
        runOnUiThread {
          Toast.makeText(context, "تعذر مشاركة النص: ${e.message}", Toast.LENGTH_SHORT).show()
        }
      }
    }

    @JavascriptInterface
    fun saveFile(fileName: String, base64Data: String, mimeType: String) {
      try {
        val decodedBytes = Base64.decode(base64Data, Base64.DEFAULT)
        val cacheDir = File(context.cacheDir, "exports").apply { mkdirs() }
        val file = File(cacheDir, fileName)
        FileOutputStream(file).use { it.write(decodedBytes) }

        val uri: Uri = try {
          FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        } catch (e: Exception) {
          Uri.fromFile(file)
        }

        val shareIntent = Intent(Intent.ACTION_SEND).apply {
          type = mimeType
          putExtra(Intent.EXTRA_STREAM, uri)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        val chooser = Intent.createChooser(shareIntent, "مشاركة / حفظ الملف").apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(chooser)
      } catch (e: Exception) {
        runOnUiThread {
          Toast.makeText(context, "فشل حفظ الملف: ${e.message}", Toast.LENGTH_LONG).show()
        }
      }
    }

    @JavascriptInterface
    fun vibrate() {
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
          vibratorManager?.defaultVibrator?.vibrate(VibrationEffect.createOneShot(30, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
          @Suppress("DEPRECATION")
          val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
          @Suppress("DEPRECATION")
          vibrator?.vibrate(30)
        }
      } catch (_: Exception) {}
    }
  }
}
