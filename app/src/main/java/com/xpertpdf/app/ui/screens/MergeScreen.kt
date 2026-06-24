package com.xpertpdf.app.ui.screens

import android.net.Uri
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.tom_roush.pdfbox.multipdf.PDFMergerUtility
import com.xpertpdf.app.managers.CacheManager
import com.xpertpdf.app.managers.CrashManager
import com.xpertpdf.app.managers.PdfManager
import com.xpertpdf.app.managers.StorageFile
import com.xpertpdf.app.ui.components.FileBrowser
import com.xpertpdf.app.utils.Localization
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MergeScreen(
    navController: NavController,
    language: String
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var selectedFiles by remember { mutableStateOf<List<StorageFile>>(emptyList()) }
    var mergedFile: File? by remember { mutableStateOf(null) }
    var isProcessing by remember { mutableStateOf(false) }
    var isBrowserOpen by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(Localization.translate(language, "merge"), fontWeight = FontWeight.ExtraBold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(imageVector = Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentAlignment = Alignment.Center
        ) {
            if (selectedFiles.isEmpty() && mergedFile == null) {
                // Empty state to browse
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.MergeType,
                        contentDescription = "Merge",
                        tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.4f),
                        modifier = Modifier.size(92.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Combine multiple PDF documents into one",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { isBrowserOpen = true },
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(imageVector = Icons.Default.Add, contentDescription = "Select Files")
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Select PDF Files")
                    }
                }
            } else if (isProcessing) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Merging files safely on-device...", fontWeight = FontWeight.Bold)
                }
            } else if (mergedFile != null) {
                // Success State
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = "Success",
                        tint = Color(0xFF34A853),
                        modifier = Modifier.size(72.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Merge Successful!",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF34A853)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = mergedFile!!.name,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                    Text(
                        text = "Location: Cache Directory",
                        fontSize = 12.sp,
                        color = Color.Gray
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(
                        onClick = {
                            selectedFiles = emptyList()
                            mergedFile = null
                            errorMessage = null
                        },
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Merge More Files")
                    }
                }
            } else {
                // File List and configuration view
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Files to Combine (${selectedFiles.size})",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Row {
                            IconButton(onClick = { isBrowserOpen = true }) {
                                Icon(imageVector = Icons.Default.Add, contentDescription = "Add More", tint = MaterialTheme.colorScheme.primary)
                            }
                            IconButton(onClick = { selectedFiles = emptyList() }) {
                                Icon(imageVector = Icons.Default.DeleteSweep, contentDescription = "Clear All", tint = MaterialTheme.colorScheme.error)
                            }
                        }
                    }

                    if (errorMessage != null) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 12.dp)
                        ) {
                            Text(
                                text = errorMessage!!,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }

                    LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        itemsIndexed(selectedFiles) { index, file ->
                            Card(
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.PictureAsPdf,
                                        contentDescription = "PDF Document",
                                        tint = Color(0xFFEA4335)
                                    )
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = file.name,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp,
                                            maxLines = 1
                                        )
                                        Text(
                                            text = file.formattedSize,
                                            fontSize = 11.sp,
                                            color = Color.Gray
                                        )
                                    }
                                    
                                    // Move Up action
                                    IconButton(
                                        onClick = {
                                            if (index > 0) {
                                                val list = selectedFiles.toMutableList()
                                                val temp = list[index]
                                                list[index] = list[index - 1]
                                                list[index - 1] = temp
                                                selectedFiles = list
                                            }
                                        },
                                        enabled = index > 0
                                    ) {
                                        Icon(imageVector = Icons.Default.ArrowUpward, contentDescription = "Move Up", tint = if (index > 0) MaterialTheme.colorScheme.primary else Color.LightGray)
                                    }

                                    // Move Down action
                                    IconButton(
                                        onClick = {
                                            if (index < selectedFiles.size - 1) {
                                                val list = selectedFiles.toMutableList()
                                                val temp = list[index]
                                                list[index] = list[index + 1]
                                                list[index + 1] = temp
                                                selectedFiles = list
                                            }
                                        },
                                        enabled = index < selectedFiles.size - 1
                                    ) {
                                        Icon(imageVector = Icons.Default.ArrowDownward, contentDescription = "Move Down", tint = if (index < selectedFiles.size - 1) MaterialTheme.colorScheme.primary else Color.LightGray)
                                    }

                                    // Delete action
                                    IconButton(
                                        onClick = { selectedFiles = selectedFiles.filter { it.path != file.path } }
                                    ) {
                                        Icon(imageVector = Icons.Default.Delete, contentDescription = "Remove", tint = MaterialTheme.colorScheme.error)
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = {
                            isProcessing = true
                            errorMessage = null
                            scope.launch(Dispatchers.IO) {
                                val tempFiles = mutableListOf<File>()
                                try {
                                    val merger = PDFMergerUtility()
                                    
                                    // Validate and copy files
                                    for (file in selectedFiles) {
                                        val validation = PdfManager.validatePdf(context, file.path)
                                        if (!validation.first) {
                                            throw IllegalArgumentException("File ${file.name} failed verification: ${validation.second}")
                                        }
                                        
                                        val localFile = PdfManager.getLocalFile(context, file.path)
                                        merger.addSource(localFile)
                                        if (file.isUriBased) {
                                            tempFiles.add(localFile) // only delete it if it is a cached copy
                                        }
                                    }

                                    val output = File(context.cacheDir, "merged_output_${System.currentTimeMillis()}.pdf")
                                    merger.destinationFileName = output.absolutePath
                                    
                                    // Merge documents utilizing safety limits
                                    merger.mergeDocuments(com.tom_roush.pdfbox.io.MemoryUsageSetting.setupMainMemoryOnly())

                                    // Cleanup local copies
                                    tempFiles.forEach { it.delete() }

                                    withContext(Dispatchers.Main) {
                                        mergedFile = output
                                        isProcessing = false
                                    }
                                } catch (t: Throwable) {
                                    t.printStackTrace()
                                    CrashManager.logCrash(context, "Merge", t)
                                    tempFiles.forEach { it.delete() }
                                    withContext(Dispatchers.Main) {
                                        isProcessing = false
                                        errorMessage = "Failed to combine PDFs. ${t.localizedMessage ?: "File format error."}"
                                    }
                                }
                            }
                        },
                        enabled = selectedFiles.size >= 2,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(imageVector = Icons.Default.MergeType, contentDescription = "Merge")
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = "Combine Documents", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }

    if (isBrowserOpen) {
        FileBrowser(
            title = "Select PDF Files",
            multiSelect = true,
            allowedTypes = listOf("pdf"),
            onFilesSelected = { selection ->
                isBrowserOpen = false
                selectedFiles = selectedFiles + selection.filter { f -> !selectedFiles.any { it.path == f.path } }
            },
            onDismiss = { isBrowserOpen = false }
        )
    }
}
