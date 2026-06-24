package com.xpertpdf.app.managers

import android.content.Context
import android.os.Build
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object CrashManager {
    private const val LOG_FILE_NAME = "xpertpdf_crash_logs.txt"

    fun logCrash(context: Context, toolName: String, error: Throwable, additionalInfo: String = "") {
        try {
            val logFile = File(context.filesDir, LOG_FILE_NAME)
            val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date())
            
            val sw = StringWriter()
            val pw = PrintWriter(sw)
            error.printStackTrace(pw)
            val stackTrace = sw.toString()

            val logEntry = """
                ========================================
                Timestamp: $timestamp
                Tool: $toolName
                Device Model: ${Build.MODEL} (${Build.MANUFACTURER})
                Android SDK: ${Build.VERSION.SDK_INT}
                Additional Info: $additionalInfo
                
                Stack Trace:
                $stackTrace
                ========================================
                
            """.trimIndent()

            logFile.appendText(logEntry)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun getCrashLogs(context: Context): String {
        return try {
            val logFile = File(context.filesDir, LOG_FILE_NAME)
            if (logFile.exists()) {
                logFile.readText()
            } else {
                "No logs found."
            }
        } catch (e: Exception) {
            "Error loading logs: ${e.message}"
        }
    }

    fun clearCrashLogs(context: Context) {
        try {
            val logFile = File(context.filesDir, LOG_FILE_NAME)
            if (logFile.exists()) {
                logFile.delete()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
