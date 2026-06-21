package com.xpertpdf.app.ui.screens

import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.xpertpdf.app.utils.Localization
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import android.util.LruCache

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ViewerScreen(
    navController: NavController,
    language: String
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pdfUri by remember { mutableStateOf<Uri?>(null) }
    var pdfRenderer by remember { mutableStateOf<PdfRenderer?>(null) }
    var pageCount by remember { mutableStateOf(0) }
    var currentPageIndex by remember { mutableStateOf(0) }

    // LRU Bitmap Cache to maintain stable memory usage and high-performance scrolling
    val bitmapCache = remember {
        object : LruCache<Int, Bitmap>((Runtime.getRuntime().maxMemory() / 1024 / 8).toInt()) {
            override fun sizeOf(key: Int, value: Bitmap): Int {
                return value.byteCount / 1024
            }
        }
    }

    // Lazy list state to track and scroll to target pages
    val listState = rememberLazyListState()

    // File Picker integration
    val pickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            pdfUri = uri
            scope.launch(Dispatchers.IO) {
                try {
                    // Copy URI stream safely to a cache file to allow RandomAccessFile descriptors
                    val tempFile = File(context.cacheDir, "loaded_doc.pdf")
                    val inputStream: InputStream? = context.contentResolver.openInputStream(uri)
                    inputStream?.use { input ->
                        FileOutputStream(tempFile).use { output ->
                            input.copyTo(output)
                        }
                    }

                    val fileDescriptor = ParcelFileDescriptor.open(
                        tempFile,
                        ParcelFileDescriptor.MODE_READ_ONLY
                    )
                    val renderer = PdfRenderer(fileDescriptor)
                    bitmapCache.evictAll()

                    withContext(Dispatchers.Main) {
                        pdfRenderer = renderer
                        pageCount = renderer.pageCount
                        currentPageIndex = 0
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    // Capture currently visible item indices to track page accurately
    val firstVisibleItemIndex by remember {
        derivedStateOf { listState.firstVisibleItemIndex }
    }
    LaunchedEffect(firstVisibleItemIndex) {
        if (pageCount > 0) {
            currentPageIndex = firstVisibleItemIndex
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = if (pdfUri == null) {
                            Localization.translate(language, "viewer")
                        } else {
                            "Pages (${currentPageIndex + 1}/$pageCount)"
                        },
                        fontWeight = FontWeight.SemiBold
                    )
                },
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
            if (pdfUri == null) {
                // Land Screen - Prompt to load PDF
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(24.dp)
                ) {
                    Button(
                        onClick = { pickerLauncher.launch("application/pdf") },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary
                        ),
                        shape = RoundedCornerShape(16.dp),
                        contentPadding = PaddingValues(horizontal = 24.dp, vertical = 16.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.UploadFile,
                            contentDescription = "Upload",
                            tint = Color.White
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = Localization.translate(language, "select_pdf"),
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
            } else {
                // Document Display Core
                var scale by remember { mutableStateOf(1f) }
                var offsetX by remember { mutableStateOf(0f) }
                var offsetY by remember { mutableStateOf(0f) }

                Column(modifier = Modifier.fillMaxSize()) {
                    // Render viewport list
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .pointerInput(Unit) {
                                detectTransformGestures { _, pan, zoom, _ ->
                                    scale = (scale * zoom).coerceIn(1f, 5f)
                                    offsetX += pan.x
                                    offsetY += pan.y
                                    if (scale == 1f) {
                                        offsetX = 0f
                                        offsetY = 0f
                                    }
                                }
                            }
                            .graphicsLayer(
                                scaleX = scale,
                                scaleY = scale,
                                translationX = offsetX,
                                translationY = offsetY
                            )
                    ) {
                        LazyColumn(
                            state = listState,
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            items(pageCount) { index ->
                                var pageBitmap by remember { mutableStateOf<Bitmap?>(null) }
                                
                                // Dynamic Pre-fetch and caching computation
                                LaunchedEffect(index) {
                                    scope.launch(Dispatchers.IO) {
                                        // Cache lookup
                                        var cached = bitmapCache.get(index)
                                        if (cached == null && pdfRenderer != null) {
                                            pdfRenderer?.let { r ->
                                                synchronized(r) {
                                                    val page = r.openPage(index)
                                                    // High density scaled raster rendering
                                                    val width = page.width * 2
                                                    val height = page.height * 2
                                                    val bitmap = Bitmap.createBitmap(
                                                        width,
                                                        height,
                                                        Bitmap.Config.ARGB_8888
                                                    )
                                                    // Fill with solid white before rendering vector path
                                                    bitmap.eraseColor(android.graphics.Color.WHITE)
                                                    page.render(
                                                        bitmap,
                                                        null,
                                                        null,
                                                        PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY
                                                    )
                                                    page.close()
                                                    bitmapCache.put(index, bitmap)
                                                    cached = bitmap
                                                }
                                            }
                                        }
                                        
                                        // Handle prefetching for 3-pages padding
                                        for (i in 1..3) {
                                            val forwardIndex = index + i
                                            if (forwardIndex < pageCount && bitmapCache.get(forwardIndex) == null) {
                                                launchPrefetchPage(context, pdfRenderer, forwardIndex, bitmapCache)
                                            }
                                            val reverseIndex = index - i
                                            if (reverseIndex >= 0 && bitmapCache.get(reverseIndex) == null) {
                                                launchPrefetchPage(context, pdfRenderer, reverseIndex, bitmapCache)
                                            }
                                        }

                                        withContext(Dispatchers.Main) {
                                            pageBitmap = cached
                                        }
                                    }
                                }

                                Card(
                                    colors = CardDefaults.cardColors(containerColor = Color.White),
                                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .aspectRatio(0.707f) // Keep standard A4 Aspect ratio
                                ) {
                                    Box(
                                        modifier = Modifier.fillMaxSize(),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        pageBitmap?.let { bitmap ->
                                            Image(
                                                bitmap = bitmap.asImageBitmap(),
                                                contentDescription = "Page ${index + 1}",
                                                modifier = Modifier.fillMaxSize()
                                            )
                                        } ?: CircularProgressIndicator(
                                            color = MaterialTheme.colorScheme.primary,
                                            modifier = Modifier.size(36.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Navigation footer triggers
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp)
                            .background(
                                MaterialTheme.colorScheme.surface,
                                shape = RoundedCornerShape(16.dp)
                            )
                            .padding(8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = {
                                if (currentPageIndex > 0) {
                                    scope.launch { listState.animateScrollToItem(currentPageIndex - 1) }
                                }
                            },
                            enabled = currentPageIndex > 0
                        ) {
                            Icon(Icons.Default.ChevronLeft, contentDescription = "Prev")
                        }

                        Text(
                            text = "Page ${currentPageIndex + 1} of $pageCount",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium
                        )

                        IconButton(
                            onClick = {
                                if (currentPageIndex < pageCount - 1) {
                                    scope.launch { listState.animateScrollToItem(currentPageIndex + 1) }
                                }
                            },
                            enabled = currentPageIndex < pageCount - 1
                        ) {
                            Icon(Icons.Default.ChevronRight, contentDescription = "Next")
                        }
                    }
                }
            }
        }
    }
}

// Optimized worker task to prefetch bitmap pages onto background threads
private fun launchPrefetchPage(
    context: Context,
    renderer: PdfRenderer?,
    pageIndex: Int,
    bitmapCache: LruCache<Int, Bitmap>
) {
    if (renderer == null) return
    try {
        synchronized(renderer) {
            if (bitmapCache.get(pageIndex) == null) {
                val page = renderer.openPage(pageIndex)
                val width = page.width * 2
                val height = page.height * 2
                val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                bitmap.eraseColor(android.graphics.Color.WHITE)
                page.render(
                    bitmap,
                    null,
                    null,
                    PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY
                )
                page.close()
                bitmapCache.put(pageIndex, bitmap)
            }
        }
    } catch (e: Exception) {
        e.printStackTrace()
    }
}
