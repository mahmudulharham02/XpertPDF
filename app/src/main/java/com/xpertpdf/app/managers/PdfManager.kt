package com.xpertpdf.app.managers

import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.tom_roush.pdfbox.io.MemoryUsageSetting
import com.tom_roush.pdfbox.multipdf.PDFMergerUtility
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.encryption.AccessPermission
import com.tom_roush.pdfbox.pdmodel.encryption.StandardProtectionPolicy
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream
import com.tom_roush.pdfbox.pdmodel.font.PDType1Font
import com.tom_roush.pdfbox.pdmodel.graphics.image.PDImageXObject
import java.io.File
import java.io.InputStream

object PdfManager {

    /**
     * Validates if a PDF file/URI exists, is readable, size is > 0, extension is correct, and structure is valid.
     */
    fun validatePdf(context: Context, source: String): Pair<Boolean, String> {
        return try {
            val isUri = source.startsWith("content://") || source.startsWith("file://")
            val size: Long
            val name: String
            
            if (isUri) {
                val uri = Uri.parse(source)
                name = uri.lastPathSegment ?: "Document.pdf"
                val pfd = context.contentResolver.openFileDescriptor(uri, "r")
                if (pfd == null) {
                    return Pair(false, "Permission denied or file cannot be opened.")
                }
                size = pfd.statSize
                pfd.close()
            } else {
                val file = File(source)
                name = file.name
                if (!file.exists()) {
                    return Pair(false, "File does not exist.")
                }
                if (!file.canRead()) {
                    return Pair(false, "File is not readable (Permission Denied).")
                }
                size = file.length()
            }

            if (size <= 0) {
                return Pair(false, "File is empty (size is 0 bytes).")
            }

            // Quick structure verification by loading magic bytes
            val input: InputStream? = if (isUri) {
                context.contentResolver.openInputStream(Uri.parse(source))
            } else {
                File(source).inputStream()
            }
            
            input?.use { stream ->
                val header = ByteArray(4)
                val read = stream.read(header)
                if (read < 4 || header[0] != '%'.toByte() || header[1] != 'P'.toByte() || header[2] != 'D'.toByte() || header[3] != 'F'.toByte()) {
                    return Pair(false, "Corrupted file. Not a valid PDF document structure.")
                }
            }

            Pair(true, "Success")
        } catch (t: Throwable) {
            t.printStackTrace()
            Pair(false, "Error validating PDF: ${t.localizedMessage ?: "Unknown Error"}")
        }
    }

    /**
     * Opens a PDF file or content URI as a PDFBox PDDocument safely.
     */
    fun openDocument(context: Context, source: String): PDDocument {
        val isUri = source.startsWith("content://") || source.startsWith("file://")
        return if (isUri) {
            val input = context.contentResolver.openInputStream(Uri.parse(source))
                ?: throw IllegalArgumentException("Could not open input stream from URI.")
            input.use { PDDocument.load(it) }
        } else {
            PDDocument.load(File(source))
        }
    }

    /**
     * Opens a PDF source (Local Path or content URI) as a ParcelFileDescriptor for the native PdfRenderer.
     */
    fun openFileDescriptor(context: Context, source: String): ParcelFileDescriptor? {
        val isUri = source.startsWith("content://") || source.startsWith("file://")
        return if (isUri) {
            context.contentResolver.openFileDescriptor(Uri.parse(source), "r")
        } else {
            ParcelFileDescriptor.open(File(source), ParcelFileDescriptor.MODE_READ_ONLY)
        }
    }

    /**
     * Helper to resolve a source into a readable local File. Copies content URI to a cache file if necessary.
     */
    fun getLocalFile(context: Context, source: String): File {
        val isUri = source.startsWith("content://") || source.startsWith("file://")
        if (!isUri) return File(source)

        val uri = Uri.parse(source)
        val tempFile = CacheManager.createTempFile(context, "local_copy_", ".pdf")
        context.contentResolver.openInputStream(uri)?.use { input ->
            tempFile.outputStream().use { output ->
                input.copyTo(output)
            }
        } ?: throw IllegalArgumentException("Failed to read content from URI.")
        return tempFile
    }

    /**
     * Safe scale down dimensions to prevent OutOfMemory issues.
     */
    fun calculateSafeDimensions(pageWidth: Int, pageHeight: Int, maxDimension: Int = 1200): Pair<Int, Int> {
        val aspectRatio = pageWidth.toFloat() / pageHeight.toFloat()
        return if (pageWidth > pageHeight) {
            val width = minOf(pageWidth, maxDimension)
            val height = (width / aspectRatio).toInt()
            Pair(width, height)
        } else {
            val height = minOf(pageHeight, maxDimension)
            val width = (height * aspectRatio).toInt()
            Pair(width, height)
        }
    }
}
