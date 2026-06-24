package com.xpertpdf.app.managers

import android.content.Context
import android.content.SharedPreferences

class SessionManager private constructor(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("XpertPDF_Prefs", Context.MODE_PRIVATE)

    companion object {
        @Volatile
        private var INSTANCE: SessionManager? = null

        fun getInstance(context: Context): SessionManager {
            return INSTANCE ?: synchronized(this) {
                val instance = SessionManager(context.applicationContext)
                INSTANCE = instance
                instance
            }
        }
    }

    fun setTheme(isDark: Boolean) {
        prefs.edit().putBoolean("is_dark_theme", isDark).apply()
    }

    fun isDarkTheme(): Boolean {
        return prefs.getBoolean("is_dark_theme", false)
    }

    fun setLanguage(lang: String) {
        prefs.edit().putString("language", lang).apply()
    }

    fun getLanguage(): String {
        return prefs.getString("language", "en") ?: "en"
    }

    fun setFont(font: String) {
        prefs.edit().putString("font_family", font).apply()
    }

    fun getFont(): String {
        return prefs.getString("font_family", "sans") ?: "sans"
    }

    fun setLastSelectedFolder(path: String) {
        prefs.edit().putString("last_selected_folder", path).apply()
    }

    fun getLastSelectedFolder(): String? {
        return prefs.getString("last_selected_folder", null)
    }

    fun saveLastSession(filePath: String, page: Int, zoom: Float, scrollX: Int, scrollY: Int) {
        prefs.edit()
            .putString("last_opened_pdf", filePath)
            .putInt("last_page_viewed", page)
            .putFloat("last_zoom_level", zoom)
            .putInt("last_scroll_x", scrollX)
            .putInt("last_scroll_y", scrollY)
            .apply()
    }

    fun getLastOpenedPdf(): String? {
        return prefs.getString("last_opened_pdf", null)
    }

    fun getLastPageViewed(): Int {
        return prefs.getInt("last_page_viewed", 0)
    }

    fun getLastZoomLevel(): Float {
        return prefs.getFloat("last_zoom_level", 1.0f)
    }

    fun getLastScrollX(): Int {
        return prefs.getInt("last_scroll_x", 0)
    }

    fun getLastScrollY(): Int {
        return prefs.getInt("last_scroll_y", 0)
    }

    fun setScrollMode(continuous: Boolean) {
        prefs.edit().putBoolean("continuous_scroll", continuous).apply()
    }

    fun isContinuousScroll(): Boolean {
        return prefs.getBoolean("continuous_scroll", true)
    }

    fun setReadingMode(mode: String) {
        prefs.edit().putString("reading_mode", mode).apply()
    }

    fun getReadingMode(): String {
        return prefs.getString("reading_mode", "vertical") ?: "vertical" // vertical, horizontal, single
    }
}
