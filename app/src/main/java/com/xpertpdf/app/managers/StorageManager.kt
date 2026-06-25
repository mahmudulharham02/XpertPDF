package com.xpertpdf.app.managers

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.documentfile.provider.DocumentFile
import java.io.File
import java.text.DecimalFormat

data class StorageFile(
    val name: String,
    val path: String, // local absolute path or document uri string
    val isDirectory: Boolean,
    val size: Long,
    val lastModified: Long,
    val fileExtension: String,
    val isUriBased: Boolean = false
) {
    val formattedSize: String
        get() {
            if (isDirectory) return ""
            if (size <= 0) return "0 B"
            val units = arrayOf("B", "KB", "MB", "GB", "TB")
            val digitGroups = (Math.log10(size.toDouble()) / Math.log10(1024.0)).toInt()
            val index = minOf(digitGroups, units.size - 1)
            return DecimalFormat("#,##0.#").format(size / Math.pow(1024.0, index.toDouble())) + " " + units[index]
        }
}

object StorageManager {
    
    // Get required storage permissions list based on Android API level
    fun getStoragePermissions(): List<String> {
        val permissions = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.READ_MEDIA_IMAGES)
            permissions.add(Manifest.permission.READ_MEDIA_VIDEO)
            permissions.add(Manifest.permission.READ_MEDIA_AUDIO)
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
        } else {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
            permissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        }
        return permissions
    }

    // Check if storage permissions are fully granted
    fun hasStoragePermissions(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED ||
                   ContextCompat.checkSelfPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
        } else {
            for (permission in getStoragePermissions()) {
                if (ContextCompat.checkSelfPermission(context, permission) != PackageManager.PERMISSION_GRANTED) {
                    return false
                }
            }
            return true
        }
    }

    // Get required permissions list based on Android API level (legacy/camera inclusive)
    fun getRequiredPermissions(): List<String> {
        val permissions = mutableListOf<String>()
        permissions.add(Manifest.permission.CAMERA)
        permissions.addAll(getStoragePermissions())
        return permissions
    }

    // Check if permissions are fully granted (legacy/camera inclusive)
    fun hasPermissions(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED &&
               hasStoragePermissions(context)
    }

    // Request permissions through standard Activity request code
    fun requestAppPermissions(activity: Activity, requestCode: Int) {
        val permissions = getRequiredPermissions().toTypedArray()
        ActivityCompat.requestPermissions(activity, permissions, requestCode)
    }

    // Opens application system settings page if permissions permanently denied
    fun openAppSettings(context: Context) {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", context.packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // Retrieve predefined native directories to navigate
    fun getNativeShortcutDirectories(context: Context): List<Pair<String, File>> {
        val list = mutableListOf<Pair<String, File>>()
        try {
            val internalStorage = Environment.getExternalStorageDirectory()
            list.add(Pair("Internal Storage", internalStorage))
            
            val downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            if (downloads.exists()) list.add(Pair("Downloads", downloads))
            
            val documents = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS)
            if (documents.exists()) list.add(Pair("Documents", documents))

            val dcim = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM)
            if (dcim.exists()) list.add(Pair("DCIM", dcim))

            val pictures = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
            if (pictures.exists()) list.add(Pair("Pictures", pictures))

            // Add standard App-specific internal directories as guaranteed safety fallback
            list.add(Pair("App Cache", context.cacheDir))
            list.add(Pair("App Files", context.filesDir))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return list
    }

    // List files in a local folder with support for safety fallbacks and permission guards
    fun listLocalFolderFiles(
        folder: File,
        searchQuery: String = "",
        sortBy: String = "name", // name, size, date
        filterExtensions: List<String> = emptyList()
    ): List<StorageFile> {
        val storageFiles = mutableListOf<StorageFile>()
        try {
            val files = folder.listFiles() ?: return emptyList()
            for (file in files) {
                val ext = file.extension.lowercase()
                
                // Extension Filtering Logic
                if (!file.isDirectory && filterExtensions.isNotEmpty() && ext !in filterExtensions) {
                    continue
                }
                
                // Search Query logic
                if (searchQuery.isNotEmpty() && !file.name.contains(searchQuery, ignoreCase = true)) {
                    continue
                }

                storageFiles.add(
                    StorageFile(
                        name = file.name,
                        path = file.absolutePath,
                        isDirectory = file.isDirectory,
                        size = if (file.isDirectory) 0 else file.length(),
                        lastModified = file.lastModified(),
                        fileExtension = ext,
                        isUriBased = false
                    )
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Sorting Logic
        return when (sortBy.lowercase()) {
            "size" -> storageFiles.sortedWith(compareByDescending<StorageFile> { it.isDirectory }.thenBy { it.size })
            "date" -> storageFiles.sortedWith(compareByDescending<StorageFile> { it.isDirectory }.thenByDescending { it.lastModified })
            else -> storageFiles.sortedWith(compareByDescending<StorageFile> { it.isDirectory }.thenBy { it.name.lowercase() })
        }
    }

    // List document tree files via SAF (Storage Access Framework) to overcome API 11+ restrictions
    fun listSapFolderFiles(
        context: Context,
        treeUri: Uri,
        searchQuery: String = "",
        sortBy: String = "name",
        filterExtensions: List<String> = emptyList()
    ): List<StorageFile> {
        val storageFiles = mutableListOf<StorageFile>()
        try {
            val treeDoc = DocumentFile.fromTreeUri(context, treeUri) ?: return emptyList()
            val files = treeDoc.listFiles()
            for (doc in files) {
                val name = doc.name ?: continue
                val isDir = doc.isDirectory
                val lastDot = name.lastIndexOf('.')
                val ext = if (lastDot != -1) name.substring(lastDot + 1).lowercase() else ""

                if (!isDir && filterExtensions.isNotEmpty() && ext !in filterExtensions) {
                    continue
                }

                if (searchQuery.isNotEmpty() && !name.contains(searchQuery, ignoreCase = true)) {
                    continue
                }

                storageFiles.add(
                    StorageFile(
                        name = name,
                        path = doc.uri.toString(),
                        isDirectory = isDir,
                        size = if (isDir) 0 else doc.length(),
                        lastModified = doc.lastModified(),
                        fileExtension = ext,
                        isUriBased = true
                    )
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return when (sortBy.lowercase()) {
            "size" -> storageFiles.sortedWith(compareByDescending<StorageFile> { it.isDirectory }.thenBy { it.size })
            "date" -> storageFiles.sortedWith(compareByDescending<StorageFile> { it.isDirectory }.thenByDescending { it.lastModified })
            else -> storageFiles.sortedWith(compareByDescending<StorageFile> { it.isDirectory }.thenBy { it.name.lowercase() })
        }
    }
}
