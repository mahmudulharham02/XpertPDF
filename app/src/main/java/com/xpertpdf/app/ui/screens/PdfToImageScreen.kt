package com.xpertpdf.app.ui.screens

import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import androidx.compose.animation.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.xpertpdf.app.managers.CacheManager
import com.xpertpdf.app.managers.CrashManager
import com.xpertpdf.app.managers.PdfManager
import com.xpertpdf.app.ui.components.FileBrowser
import com.xpertpdf.app.utils.Localization
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PdfToImageScreen(
    navController: NavController,
    language: String
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pdfSource by remember { mutableStateOf<String?>(null) }
    var convertedBitmaps by remember { mutableStateOf<List<Bitmap>>(emptyList()) }
    var isProcessing by remember { mutableStateOf(false) }
    var isBrowserOpen by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(Localization.translate(language, "pdfToImage"), fontWeight = FontWeight.ExtraBold) },
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
                // Empty state to browse
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.FilterFrames,
                        contentDescription = "PDF to Image",
                        tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.4f),
                        modifier = Modifier.size(92.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Rasterize and convert PDF pages into image formats",
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
                    Text("Converting document pages safely on-device...", fontWeight = FontWeight.Bold)
                }
            } else {
                // Done View with converted list
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Rendered Pages (${convertedBitmaps.size} converted)", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Button(
                            onClick = { pdfSource = null },
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Icon(imageVector = Icons.Default.Refresh, contentDescription = "New PDF", modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("New PDF", fontSize = 12.sp)
                        }
                    }

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

                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        itemsIndexed(convertedBitmaps) { index, bitmap ->
                            Card(
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .aspectRatio(0.707f)
                            ) {
                                Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                                    Image(
                                        bitmap = bitmap.asImageBitmap(),
                                        contentDescription = "Page ${index + 1}",
                                        modifier = Modifier.fillMaxSize()
                                    )
                                    Box(
                                        modifier = Modifier
                                            .align(Alignment.BottomStart)
                                            .padding(8.dp)
                                            .background(
                                                Color.Black.copy(alpha = 0.6f),
                                                shape = RoundedCornerShape(4.dp)
                                            )
                                            .padding(horizontal = 6.dp, vertical = 2.dp)
                                    ) {
                                        Text(
                                            text = "Page ${index + 1}",
                                            color = Color.White,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (isBrowserOpen) {
        FileBrowser(
            title = "Select PDF to Convert",
            allowedTypes = listOf("pdf"),
            onFilesSelected = { selection ->
                isBrowserOpen = false
                if (selection.isNotEmpty()) {
                    pdfSource = selection[0].path
                    convertedBitmaps = emptyList()
                    isProcessing = true
                    errorMessage = null
                    scope.launch(Dispatchers.IO) {
                        try {
                            val validation = PdfManager.validatePdf(context, selection[0].path)
                            if (!validation.first) {
                                throw IllegalArgumentException(validation.second)
                            }

                            val fileDescriptor = PdfManager.openFileDescriptor(context, selection[0].path)
                            if (fileDescriptor == null) {
                                throw IllegalStateException("Could not open file descriptor")
                            }

                            val renderer = PdfRenderer(fileDescriptor)
                            val imageList = mutableListOf<Bitmap>()
                            
                            val limit = minOf(renderer.pageCount, 15) // limit to 15 pages in preview mode for OOM safety
                            for (i in 0 until limit) {
                                val page = renderer.openPage(i)
                                val (width, height) = PdfManager.calculateSafeDimensions(page.width, page.height)
                                val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                                bitmap.eraseColor(android.graphics.Color.WHITE)
                                page.render(
                                    bitmap,
                                    null,
                                    null,
                                    PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY
                                )
                                page.close()
                                imageList.add(bitmap)
                            }
                            
                            renderer.close()
                            withContext(Dispatchers.Main) {
                                convertedBitmaps = imageList
                                isProcessing = false
                            }
                        } catch (t: Throwable) {
                            t.printStackTrace()
                            CrashManager.logCrash(context, "PdfToImage", t)
                            withContext(Dispatchers.Main) {
                                isProcessing = false
                                errorMessage = "Failed to convert PDF pages. ${t.localizedMessage ?: "Out of memory."}"
                            }
                        }
                    }
                }
            },
            onDismiss = { isBrowserOpen = false }
        )
    }
}
