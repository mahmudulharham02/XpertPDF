package com.xpertpdf.app.ui.screens

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.navigation.NavController
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPage
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream
import com.tom_roush.pdfbox.pdmodel.graphics.image.JPEGFactory
import com.xpertpdf.app.managers.CrashManager
import com.xpertpdf.app.utils.Localization
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScanScreen(
    navController: NavController,
    language: String
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    
    var hasCameraPermission by remember { mutableStateOf(false) }
    var capturedBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var resultFile: File? by remember { mutableStateOf(null) }
    var isProcessing by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Camera capture variables
    var imageCapture: ImageCapture? by remember { mutableStateOf(null) }
    val cameraExecutor: ExecutorService = remember { Executors.newSingleThreadExecutor() }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPermission = granted
    }

    LaunchedEffect(Unit) {
        permissionLauncher.launch(android.Manifest.permission.CAMERA)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(Localization.translate(language, "scan"), fontWeight = FontWeight.ExtraBold) },
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
            if (!hasCameraPermission) {
                // Permission required layout
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.DocumentScanner,
                        contentDescription = "Scan",
                        tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.4f),
                        modifier = Modifier.size(92.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Camera Access Required", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Please approve camera permissions to scan paper documents.", fontSize = 14.sp, color = Color.Gray)
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(onClick = { permissionLauncher.launch(android.Manifest.permission.CAMERA) }) {
                        Text("Grant Camera Access")
                    }
                }
            } else if (isProcessing) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Processing scanned image...", fontWeight = FontWeight.Bold)
                }
            } else if (resultFile != null) {
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
                    Text("Document Scanned & Saved!", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color(0xFF34A853))
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = resultFile!!.name, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text(text = "Location: Cache Directory", fontSize = 12.sp, color = Color.Gray)
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(
                        onClick = {
                            capturedBitmap = null
                            resultFile = null
                            errorMessage = null
                        },
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Scan New Document")
                    }
                }
            } else if (capturedBitmap != null) {
                // Post capture layout
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text("Scan Document Capture Preview", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    if (errorMessage != null) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)
                        ) {
                            Text(
                                text = errorMessage!!,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .border(1.dp, Color.LightGray, RoundedCornerShape(12.dp))
                    ) {
                        Image(
                            bitmap = capturedBitmap!!.asImageBitmap(),
                            contentDescription = "Capture Preview",
                            modifier = Modifier.fillMaxSize()
                        )
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedButton(
                            onClick = { capturedBitmap = null; errorMessage = null },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Discard")
                        }

                        Button(
                            onClick = {
                                isProcessing = true
                                errorMessage = null
                                scope.launch(Dispatchers.IO) {
                                    try {
                                        val document = PDDocument()
                                        val page = PDPage()
                                        document.addPage(page)
                                        
                                        val imageXObject = JPEGFactory.createFromImage(document, capturedBitmap)
                                        val contentStream = PDPageContentStream(document, page)
                                        
                                        val pageWidth = page.mediaBox.width
                                        val pageHeight = page.mediaBox.height
                                        contentStream.drawImage(imageXObject, 0f, 0f, pageWidth, pageHeight)
                                        contentStream.close()

                                        val outFile = File(context.cacheDir, "scan_${System.currentTimeMillis()}.pdf")
                                        document.save(outFile)
                                        document.close()
                                        
                                        withContext(Dispatchers.Main) {
                                            resultFile = outFile
                                            isProcessing = false
                                        }
                                    } catch (t: Throwable) {
                                        t.printStackTrace()
                                        CrashManager.logCrash(context, "Scan Convert", t)
                                        withContext(Dispatchers.Main) {
                                            isProcessing = false
                                            errorMessage = "Failed to convert image to PDF document. ${t.localizedMessage ?: "Out of memory."}"
                                        }
                                    }
                                }
                            },
                            modifier = Modifier.weight(1.2f),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(imageVector = Icons.Default.PictureAsPdf, contentDescription = "PDF")
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Save as PDF")
                        }
                    }
                }
            } else {
                // Camera capture preview view
                Box(modifier = Modifier.fillMaxSize()) {
                    AndroidView(
                        factory = { ctx ->
                            val previewView = PreviewView(ctx)
                            val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                            cameraProviderFuture.addListener({
                                val cameraProvider = cameraProviderFuture.get()
                                val preview = Preview.Builder().build().also {
                                    it.setSurfaceProvider(previewView.surfaceProvider)
                                }
                                imageCapture = ImageCapture.Builder().build()
                                val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

                                try {
                                    cameraProvider.unbindAll()
                                    cameraProvider.bindToLifecycle(
                                        lifecycleOwner,
                                        cameraSelector,
                                        preview,
                                        imageCapture
                                    )
                                } catch (exc: Exception) {
                                    exc.printStackTrace()
                                }
                            }, ContextCompat.getMainExecutor(ctx))
                            previewView
                        },
                        modifier = Modifier.fillMaxSize()
                    )

                    // Floating snap button
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(bottom = 36.dp)
                    ) {
                        IconButton(
                            onClick = {
                                val currentCapture = imageCapture ?: return@IconButton
                                isProcessing = true
                                val photoFile = File(context.cacheDir, "temp_scan.jpg")
                                val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

                                currentCapture.takePicture(
                                    outputOptions,
                                    cameraExecutor,
                                    object : ImageCapture.OnImageSavedCallback {
                                        override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                                            val bmp = decodeSampledBitmapFromFile(photoFile.absolutePath, 1200, 1600)
                                            photoFile.delete()
                                            scope.launch {
                                                capturedBitmap = bmp
                                                isProcessing = false
                                            }
                                        }

                                        override fun onError(exception: ImageCaptureException) {
                                            exception.printStackTrace()
                                            CrashManager.logCrash(context, "Scan Capture", exception)
                                            scope.launch { isProcessing = false }
                                        }
                                    }
                                )
                            },
                            modifier = Modifier
                                .size(76.dp)
                                .clip(CircleShape)
                                .background(Color.White)
                                .padding(4.dp)
                                .border(4.dp, MaterialTheme.colorScheme.primary, CircleShape)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Camera,
                                contentDescription = "Shutter Click",
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(36.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun decodeSampledBitmapFromFile(path: String, reqWidth: Int, reqHeight: Int): Bitmap {
    val options = BitmapFactory.Options().apply {
        inJustDecodeBounds = true
    }
    BitmapFactory.decodeFile(path, options)
    options.inSampleSize = calculateInSampleSize(options, reqWidth, reqHeight)
    options.inJustDecodeBounds = false
    return BitmapFactory.decodeFile(path, options)
}

private fun calculateInSampleSize(options: BitmapFactory.Options, reqWidth: Int, reqHeight: Int): Int {
    val (height: Int, width: Int) = options.outHeight to options.outWidth
    var inSampleSize = 1
    if (height > reqHeight || width > reqWidth) {
        val halfHeight: Int = height / 2
        val halfWidth: Int = width / 2
        while (halfHeight / inSampleSize >= reqHeight && halfWidth / inSampleSize >= reqWidth) {
            inSampleSize *= 2
        }
    }
    return inSampleSize
}
