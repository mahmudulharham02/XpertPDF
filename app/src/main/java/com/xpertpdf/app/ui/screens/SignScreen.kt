package com.xpertpdf.app.ui.screens

import android.graphics.Bitmap
import androidx.compose.animation.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream
import com.tom_roush.pdfbox.pdmodel.graphics.image.JPEGFactory
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
fun SignScreen(
    navController: NavController,
    language: String
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pdfSource by remember { mutableStateOf<String?>(null) }
    var resultFile: File? by remember { mutableStateOf(null) }
    var isProcessing by remember { mutableStateOf(false) }
    var isBrowserOpen by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Signature drawn points list
    val pathPoints = remember { mutableStateListOf<Offset>() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(Localization.translate(language, "sign"), fontWeight = FontWeight.ExtraBold) },
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
                        imageVector = Icons.Default.Create,
                        contentDescription = "Sign",
                        tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.4f),
                        modifier = Modifier.size(92.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Draw and overlay your signature on any PDF",
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
                    Text("Rendering signature layer safely...", fontWeight = FontWeight.Bold)
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
                    Text(
                        text = "PDF Signed Successfully!",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF34A853)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = resultFile!!.name,
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
                            pdfSource = null
                            resultFile = null
                            errorMessage = null
                            pathPoints.clear()
                        },
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Sign Another File")
                    }
                }
            } else {
                // Signature drawing pad and actions
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Draw Signature inside the Pad below", fontWeight = FontWeight.Bold, fontSize = 16.sp)

                    if (errorMessage != null) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = errorMessage!!,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }

                    // Interactive Drawing Canvas Pad
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .border(2.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(12.dp))
                            .background(Color.White, RoundedCornerShape(12.dp))
                            .pointerInput(Unit) {
                                detectDragGestures(
                                    onDragStart = { offset ->
                                        pathPoints.add(offset)
                                    },
                                    onDrag = { change, _ ->
                                        pathPoints.add(change.position)
                                    }
                                )
                            }
                    ) {
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            if (pathPoints.isNotEmpty()) {
                                val drawPath = Path()
                                drawPath.moveTo(pathPoints[0].x, pathPoints[0].y)
                                for (i in 1 until pathPoints.size) {
                                    drawPath.lineTo(pathPoints[i].x, pathPoints[i].y)
                                }
                                drawPath(
                                    path = drawPath,
                                    color = Color.Black,
                                    style = Stroke(width = 6f)
                                )
                            }
                        }

                        if (pathPoints.isNotEmpty()) {
                            IconButton(
                                onClick = { pathPoints.clear() },
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .padding(8.dp)
                            ) {
                                Icon(imageVector = Icons.Default.Clear, contentDescription = "Clear Pad", tint = Color.Red)
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
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
                                if (pathPoints.isEmpty()) {
                                    errorMessage = "Please draw your signature first."
                                    return@Button
                                }
                                isProcessing = true
                                errorMessage = null
                                val pointsSnapshot = pathPoints.toList()
                                scope.launch(Dispatchers.IO) {
                                    try {
                                        // Validate
                                        val validation = PdfManager.validatePdf(context, pdfSource!!)
                                        if (!validation.first) {
                                            throw IllegalArgumentException(validation.second)
                                        }

                                        // Render drawn path to temporary signature bitmap
                                        val signatureBmp = Bitmap.createBitmap(400, 200, Bitmap.Config.ARGB_8888)
                                        signatureBmp.eraseColor(android.graphics.Color.WHITE)
                                        val signatureCanvas = android.graphics.Canvas(signatureBmp)
                                        val signaturePaint = android.graphics.Paint().apply {
                                            color = android.graphics.Color.BLACK
                                            strokeWidth = 8f
                                            style = android.graphics.Paint.Style.STROKE
                                            isAntiAlias = true
                                            strokeCap = android.graphics.Paint.Cap.ROUND
                                            strokeJoin = android.graphics.Paint.Join.ROUND
                                        }

                                        if (pointsSnapshot.isNotEmpty()) {
                                            val signaturePath = android.graphics.Path()
                                            // Scale and center the coordinates onto the 400x200 bitmap
                                            signaturePath.moveTo(pointsSnapshot[0].x / 2, pointsSnapshot[0].y / 4)
                                            for (i in 1 until pointsSnapshot.size) {
                                                signaturePath.lineTo(pointsSnapshot[i].x / 2, pointsSnapshot[i].y / 4)
                                            }
                                            signatureCanvas.drawPath(signaturePath, signaturePaint)
                                        }

                                        val document = PdfManager.openDocument(context, pdfSource!!)
                                        val imageXObject = JPEGFactory.createFromImage(document, signatureBmp)

                                        if (document.numberOfPages > 0) {
                                            val page = document.getPage(0)
                                            val contentStream = PDPageContentStream(
                                                document, page,
                                                PDPageContentStream.AppendMode.APPEND,
                                                true, true
                                            )
                                            // Place the signature on the bottom right of the page
                                            contentStream.drawImage(imageXObject, 400f, 50f, 150f, 75f)
                                            contentStream.close()
                                        }

                                        val outFile = File(context.cacheDir, "signed_${System.currentTimeMillis()}.pdf")
                                        document.save(outFile)
                                        document.close()

                                        withContext(Dispatchers.Main) {
                                            resultFile = outFile
                                            isProcessing = false
                                        }
                                    } catch (t: Throwable) {
                                        t.printStackTrace()
                                        CrashManager.logCrash(context, "Sign", t)
                                        withContext(Dispatchers.Main) {
                                            isProcessing = false
                                            errorMessage = "Failed to sign document. ${t.localizedMessage ?: "File format error."}"
                                        }
                                    }
                                }
                            },
                            enabled = pathPoints.isNotEmpty(),
                            modifier = Modifier.weight(1.5f),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(imageVector = Icons.Default.Create, contentDescription = "Sign")
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Apply Signature")
                        }
                    }
                }
            }
        }
    }

    if (isBrowserOpen) {
        FileBrowser(
            title = "Select PDF to Sign",
            allowedTypes = listOf("pdf"),
            onFilesSelected = { selection ->
                isBrowserOpen = false
                if (selection.isNotEmpty()) {
                    pdfSource = selection[0].path
                    pathPoints.clear()
                }
            },
            onDismiss = { isBrowserOpen = false }
        )
    }
}
