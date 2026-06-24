package com.xpertpdf.app.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
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
import com.tom_roush.pdfbox.multipdf.Splitter
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.xpertpdf.app.managers.CacheManager
import com.xpertpdf.app.managers.CrashManager
import com.xpertpdf.app.managers.PdfManager
import com.xpertpdf.app.ui.components.FileBrowser
import com.xpertpdf.app.utils.Localization
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SplitScreen(
    navController: NavController,
    language: String
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pdfSource by remember { mutableStateOf<String?>(null) }
    var pageCount by remember { mutableStateOf(0) }
    var splitCount by remember { mutableStateOf<Int?>(null) }
    var isProcessing by remember { mutableStateOf(false) }
    var isBrowserOpen by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Analyze PDF pages when pdfSource changes
    LaunchedEffect(pdfSource) {
        val source = pdfSource
        if (source != null) {
            scope.launch(Dispatchers.IO) {
                try {
                    val validation = PdfManager.validatePdf(context, source)
                    if (!validation.first) {
                        withContext(Dispatchers.Main) {
                            errorMessage = validation.second
                        }
                        return@launch
                    }

                    val document = PdfManager.openDocument(context, source)
                    val count = document.numberOfPages
                    document.close()

                    withContext(Dispatchers.Main) {
                        pageCount = count
                        errorMessage = null
                        splitCount = null
                    }
                } catch (t: Throwable) {
                    t.printStackTrace()
                    CrashManager.logCrash(context, "Split Analyze", t)
                    withContext(Dispatchers.Main) {
                        errorMessage = "Unable to read page count. File may be encrypted or corrupted."
                    }
                }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(Localization.translate(language, "split"), fontWeight = FontWeight.ExtraBold) },
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
            if (pdfSource == null) {
                // Empty state to browse file
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.CallSplit,
                        contentDescription = "Split",
                        tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.4f),
                        modifier = Modifier.size(92.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Separate single PDF into individual pages",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { isBrowserOpen = true },
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(imageVector = Icons.Default.Search, contentDescription = "Browse")
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Select PDF File")
                    }
                }
            } else if (isProcessing) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Extracting document pages safely...", fontWeight = FontWeight.Bold)
                }
            } else if (splitCount != null) {
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
                        text = "Split Completed Successfully!",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF34A853)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Extracted $splitCount individual single-page documents.",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = "Location: Cache Directory",
                        fontSize = 12.sp,
                        color = Color.Gray
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(
                        onClick = {
                            pdfSource = null
                            splitCount = null
                            errorMessage = null
                        },
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Split Another File")
                    }
                }
            } else {
                // Settings configuration screen
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Default.PictureAsPdf,
                        contentDescription = "PDF File",
                        tint = Color(0xFFEA4335),
                        modifier = Modifier.size(72.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("PDF Source Properties", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Detected total range: 1 to $pageCount pages", color = Color.Gray, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(24.dp))

                    if (errorMessage != null) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 16.dp)
                        ) {
                            Text(
                                text = errorMessage!!,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        OutlinedButton(
                            onClick = { isBrowserOpen = true },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Change File")
                        }
                        
                        Button(
                            onClick = {
                                isProcessing = true
                                errorMessage = null
                                scope.launch(Dispatchers.IO) {
                                    try {
                                        val document = PdfManager.openDocument(context, pdfSource!!)
                                        val splitter = Splitter()
                                        val pages = splitter.split(document)
                                        
                                        // Save pages to cache
                                        for (i in 0 until pages.size) {
                                            val partDoc = pages[i]
                                            val file = File(context.cacheDir, "split_result_part_${i + 1}.pdf")
                                            partDoc.save(file)
                                            partDoc.close()
                                        }
                                        
                                        document.close()
                                        withContext(Dispatchers.Main) {
                                            splitCount = pages.size
                                            isProcessing = false
                                        }
                                    } catch (t: Throwable) {
                                        t.printStackTrace()
                                        CrashManager.logCrash(context, "Split Process", t)
                                        withContext(Dispatchers.Main) {
                                            isProcessing = false
                                            errorMessage = "Failed to split document. ${t.localizedMessage ?: "Memory full or encryption block."}"
                                        }
                                    }
                                }
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Extract Pages")
                        }
                    }
                }
            }
        }
    }

    if (isBrowserOpen) {
        FileBrowser(
            title = "Select PDF Document",
            allowedTypes = listOf("pdf"),
            onFilesSelected = { selection ->
                isBrowserOpen = false
                if (selection.isNotEmpty()) {
                    pdfSource = selection[0].path
                }
            },
            onDismiss = { isBrowserOpen = false }
        )
    }
}
