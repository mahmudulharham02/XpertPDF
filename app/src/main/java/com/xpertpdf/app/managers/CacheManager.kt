package com.xpertpdf.app.managers

import android.content.Context
import android.graphics.Bitmap
import android.util.LruCache
import java.io.File

object CacheManager {
    // In-memory bitmap cache for smooth viewer experience
    private val memoryCache: LruCache<String, Bitmap> by lazy {
        val maxMemory = (Runtime.getRuntime().maxMemory() / 1024).toInt()
        val cacheSize = maxMemory / 4 // Use 25% of the available memory
        object : LruCache<String, Bitmap>(cacheSize) {
            override fun sizeOf(key: String, bitmap: Bitmap): Int {
                return bitmap.byteCount / 1024
            }
        }
    }

    fun getCachedBitmap(key: String): Bitmap? {
        return memoryCache.get(key)
    }

    fun putCachedBitmap(key: String, bitmap: Bitmap) {
        memoryCache.put(key, bitmap)
    }

    fun clearMemoryCache() {
        memoryCache.evictAll()
    }

    /**
     * Creates a temporary file in the application's cache directory
     */
    fun createTempFile(context: Context, prefix: String, suffix: String): File {
        val cacheDir = context.cacheDir
        val tempDir = File(cacheDir, "xpertpdf_temp").apply { if (!exists()) mkdirs() }
        
        // Ensure automatic cleanup can run if needed
        cleanOldTempFiles(tempDir, maxAgeMs = 3 * 3600 * 1000) // Clear files older than 3 hours
        
        return File.createTempFile(prefix, suffix, tempDir)
    }

    /**
     * Cleans up old files in the given directory that exceed a certain age.
     */
    private fun cleanOldTempFiles(directory: File, maxAgeMs: Long) {
        try {
            val files = directory.listFiles() ?: return
            val now = System.currentTimeMillis()
            for (file in files) {
                if (now - file.lastModified() > maxAgeMs) {
                    file.delete()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Cleans up all files in the cache directory, keeping total storage under control.
     */
    fun performDiskCleanup(context: Context) {
        try {
            val tempDir = File(context.cacheDir, "xpertpdf_temp")
            if (tempDir.exists()) {
                tempDir.deleteRecursively()
            }
            // Clear other cache if any
            context.cacheDir.listFiles()?.forEach { file ->
                if (file.isFile && (file.name.contains("merged") || file.name.contains("split") || file.name.contains("watermark") || file.name.contains("signed"))) {
                    file.delete()
                }
            }
            memoryCache.evictAll()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Limits the disk cache usage. If it exceeds maxSizeInBytes, removes the oldest files.
     */
    fun enforceDiskCacheLimit(context: Context, maxSizeInBytes: Long = 100 * 1024 * 1024) { // 100 MB
        try {
            val tempDir = File(context.cacheDir, "xpertpdf_temp")
            if (!tempDir.exists()) return

            val files = tempDir.listFiles() ?: return
            var totalSize: Long = 0
            for (file in files) {
                totalSize += file.length()
            }

            if (totalSize > maxSizeInBytes) {
                // Sort by last modified ascending (oldest first)
                val sortedFiles = files.sortedBy { it.lastModified() }
                var currentSize = totalSize
                for (file in sortedFiles) {
                    val length = file.length()
                    if (file.delete()) {
                        currentSize -= length
                        if (currentSize <= maxSizeInBytes * 0.7) { // Clean down to 70% of limit
                            break
                        }
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
