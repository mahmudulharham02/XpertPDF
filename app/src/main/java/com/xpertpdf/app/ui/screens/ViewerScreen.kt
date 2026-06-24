package com.xpertpdf.app.ui.screens

import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import androidx.compose.animation.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.xpertpdf.app.managers.CacheManager
import com.xpertpdf.app.managers.CrashManager
import com.xpertpdf.app.managers.PdfManager
import com.xpertpdf.app.managers.SessionManager
import com.xpertpdf.app.managers.StorageFile
import com.xpertpdf.app.ui.components.FileBrowser
import com.xpertpdf.app.utils.Localization
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ViewerScreen(
    navController: NavController,
    language: String
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val sessionManager = remember { SessionManager.getInstance(context) }

    // State Variables
    var pdfSource by remember { mutableStateOf<String?>(null) }
    var pdfRenderer by remember { mutableStateOf<PdfRenderer?>(null) }
    var pageCount by remember { mutableStateOf(0) }
    var currentPageIndex by remember { mutableStateOf(0) }
    var isBrowserOpen by remember { mutableStateOf(false) }
    var isNightMode by remember { mutableStateOf(false) }
    var isJumpDialogOpen by remember { mutableStateOf(false) }
    var jumpPageInput by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Zoom and pan states
    var scale by remember { mutableStateOf(1f) }
    var offsetX by remember { mutableStateOf(0f) }
    var offsetY by remember { mutableStateOf(0f) }

    // Lazy list state for rendering viewport
    val listState = rememberLazyListState()

    // Restore last session on startup
    LaunchedEffect(Unit) {
        val lastOpened = sessionManager.getLastOpenedPdf()
        if (lastOpened != null) {
            val validation = PdfManager.validatePdf(context, lastOpened)
            if (validation.first) {
                pdfSource = lastOpened
            }
        }
    }

    // Load PDF when source changes
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

                    val fileDescriptor = PdfManager.openFileDescriptor(context, source)
                    if (fileDescriptor == null) {
                        withContext(Dispatchers.Main) {
                            errorMessage = "Unable to open file descriptor."
                        }
                        return@launch
                    }

                    val renderer = PdfRenderer(fileDescriptor)
                    CacheManager.clearMemoryCache()

                    withContext(Dispatchers.Main) {
                        pdfRenderer = renderer
                        pageCount = renderer.pageCount
                        errorMessage = null
                        
                        // Restore page from last session
                        val lastOpened = sessionManager.getLastOpenedPdf()
                        val targetPage = if (lastOpened == source) {
                            sessionManager.getLastPageViewed().coerceIn(0, renderer.pageCount - 1)
                        } else {
                            0
                        }
                        currentPageIndex = targetPage
                        if (targetPage > 0) {
                            listState.scrollToItem(targetPage)
                        }
                        
                        // Save session state
                        sessionManager.saveLastSession(source, targetPage, 1.0f, 0, 0)
                    }
                } catch (t: Throwable) {
                    t.printStackTrace()
                    CrashManager.logCrash(context, "Viewer", t, "Source: $source")
                    withContext(Dispatchers.Main) {
                        errorMessage = "Failed to load PDF. ${t.localizedMessage ?: "File corrupted or Out of Memory."}"
                    }
                }
            }
        }
    }

    // Track visible page index
    val firstVisibleItemIndex by remember {
        derivedStateOf { listState.firstVisibleItemIndex }
    }
    LaunchedEffect(firstVisibleItemIndex) {
        if (pageCount > 0) {
            currentPageIndex = firstVisibleItemIndex
            pdfSource?.let { source ->
                sessionManager.saveLastSession(source, currentPageIndex, scale, 0, 0)
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = if (pdfSource == null) {
                            Localization.translate(language, "viewer")
                        } else {
                            "Pages (${currentPageIndex + 1}/$pageCount)"
                        },
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 18.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(imageVector = Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (pdfSource != null) {
                        IconButton(onClick = { isNightMode = !isNightMode }) {
                            Icon(
                                imageVector = if (isNightMode) Icons.Default.LightMode else Icons.Default.DarkMode,
                                contentDescription = "Toggle Night Mode"
                            )
                        }
                        IconButton(onClick = { isJumpDialogOpen = true }) {
                            Icon(imageVector = Icons.Default.Directions, contentDescription = "Jump To Page")
                        }
                    }
                    IconButton(onClick = { isBrowserOpen = true }) {
                        Icon(imageVector = Icons.Default.FolderOpen, contentDescription = "Open File Browser")
                    }
                }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(if (isNightMode) Color(0xFF121212) else MaterialTheme.colorScheme.background),
            contentAlignment = Alignment.Center
        ) {
            if (pdfSource == null) {
                // Empty State
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.PictureAsPdf,
                        contentDescription = "PDF Icon",
                        tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.4f),
                        modifier = Modifier.size(92.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "No PDF file currently opened",
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
                        Text("Browse Device Files")
                    }
                }
            } else if (errorMessage != null) {
                // Error State
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.ErrorOutline,
                        contentDescription = "Error Icon",
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = errorMessage!!,
                        color = MaterialTheme.colorScheme.error,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { isBrowserOpen = true },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                    ) {
                        Text("Select Another File")
                    }
                }
            } else {
                // Document Display Core with viewport Gestures
                Column(modifier = Modifier.fillMaxSize()) {
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
                                
                                LaunchedEffect(index, pdfRenderer) {
                                    withContext(Dispatchers.IO) {
                                        val key = "${pdfSource}_$index"
                                        var cached = CacheManager.getCachedBitmap(key)
                                        if (cached == null && pdfRenderer != null) {
                                            pdfRenderer?.let { r ->
                                                synchronized(r) {
                                                    try {
                                                        val page = r.openPage(index)
                                                        val (width, height) = PdfManager.calculateSafeDimensions(page.width, page.height)
                                                        val bitmap = Bitmap.createBitmap(
                                                            width,
                                                            height,
                                                            Bitmap.Config.ARGB_8888
                                                        )
                                                        bitmap.eraseColor(android.graphics.Color.WHITE)
                                                        page.render(
                                                            bitmap,
                                                            null,
                                                            null,
                                                            PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY
                                                        )
                                                        page.close()
                                                        CacheManager.putCachedBitmap(key, bitmap)
                                                        cached = bitmap
                                                    } catch (t: Throwable) {
                                                        t.printStackTrace()
                                                        CrashManager.logCrash(context, "Viewer Render", t, "Page: $index")
                                                    }
                                                }
                                            }
                                        }
                                        
                                        // Dynamic prefetching of adjacent pages
                                        val nextIndex = index + 1
                                        if (nextIndex < pageCount && CacheManager.getCachedBitmap("${pdfSource}_$nextIndex") == null) {
                                            launchPrefetchPage(context, pdfSource!!, pdfRenderer, nextIndex)
                                        }

                                        withContext(Dispatchers.Main) {
                                            pageBitmap = cached
                                        }
                                    }
                                }

                                Card(
                                    colors = CardDefaults.cardColors(
                                        containerColor = if (isNightMode) Color(0xFF1E1E1E) else Color.White
                                    ),
                                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .aspectRatio(0.707f)
                                ) {
                                    Box(
                                        modifier = Modifier.fillMaxSize(),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        pageBitmap?.let { bitmap ->
                                            Image(
                                                bitmap = bitmap.asImageBitmap(),
                                                contentDescription = "Page ${index + 1}",
                                                colorFilter = if (isNightMode) ColorFilter.colorMatrix(
                                                    ColorMatrix(floatArrayOf(
                                                        -1.0f, 0.0f, 0.0f, 0.0f, 255.0f,
                                                        0.0f, -1.0f, 0.0f, 0.0f, 255.0f,
                                                        0.0f, 0.0f, -1.0f, 0.0f, 255.0f,
                                                        0.0f, 0.0f, 0.0f, 1.0f, 0.0f
                                                    ))
                                                ) else null,
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

                    // Navigation Footer
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp)
                            .background(
                                if (isNightMode) Color(0xFF1E1E1E) else MaterialTheme.colorScheme.surface,
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
                            fontWeight = FontWeight.Bold,
                            color = if (isNightMode) Color.White else MaterialTheme.colorScheme.onSurface
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

    // Unified File Browser integration
    if (isBrowserOpen) {
        FileBrowser(
            title = "Browse PDF Documents",
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

    // Jump to Page Dialog
    if (isJumpDialogOpen) {
        AlertDialog(
            onDismissRequest = { isJumpDialogOpen = false },
            title = { Text("Jump to Page", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text("Enter page number (1 to $pageCount):", fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = jumpPageInput,
                        onValueChange = { jumpPageInput = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        isJumpDialogOpen = false
                        val target = jumpPageInput.toIntOrNull()
                        if (target != null && target in 1..pageCount) {
                            scope.launch { listState.animateScrollToItem(target - 1) }
                        }
                        jumpPageInput = ""
                    }
                ) {
                    Text("Jump")
                }
            },
            dismissButton = {
                TextButton(onClick = { isJumpDialogOpen = false; jumpPageInput = "" }) {
                    Text("Cancel")
                }
            }
        )
    }
}

// Prefetch adjacent page in background
private fun launchPrefetchPage(
    context: Context,
    source: String,
    renderer: PdfRenderer?,
    pageIndex: Int
) {
    if (renderer == null) return
    try {
        val key = "${source}_$pageIndex"
        synchronized(renderer) {
            if (CacheManager.getCachedBitmap(key) == null) {
                val page = renderer.openPage(pageIndex)
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
                CacheManager.putCachedBitmap(key, bitmap)
            }
        }
    } catch (t: Throwable) {
        t.printStackTrace()
    }
}
