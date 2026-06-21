package com.xpertpdf.app.ui.screens

import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Create
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material3.*
import androidx.compose.runtime.*
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
import com.xpertpdf.app.utils.Localization
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SignScreen(
    navController: NavController,
    language: String
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pdfUri by remember { mutableStateOf<Uri?>(null) }
    var resultFile: File? by remember { mutableStateOf(null) }
    var isProcessing by remember { mutableStateOf(false) }

    // Path segments drawing tracking state
    val pathPoints = remember { mutableStateListOf<Offset>() }

    val pickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            pdfUri = uri
            resultFile = null
            pathPoints.clear()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(Localization.translate(language, "sign"), fontWeight = FontWeight.SemiBold) },
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
                Button(
                    onClick = { pickerLauncher.launch("application/pdf") },
                    shape = RoundedCornerShape(16.dp),
                    contentPadding = PaddingValues(horizontal = 24.dp, vertical = 16.dp)
                ) {
                    Icon(imageVector = Icons.Default.UploadFile, contentDescription = "Upload")
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(Localization.translate(language, "select_pdf"), fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
            } else if (isProcessing) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Rendering signature layer...", style = MaterialTheme.typography.bodyMedium)
                }
            } else if (resultFile != null) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(24.dp)
                ) {
                    Icon(imageVector = Icons.Default.Create, contentDescription = "Success", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(64.dp))
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("PDF Signed Successfully!", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Text("Saved to app cache:\n${resultFile?.name}", fontSize = 14.sp, color = Color.Gray, modifier = Modifier.padding(top = 8.dp))
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(onClick = { pdfUri = null }, shape = RoundedCornerShape(12.dp)) {
                        Text("Sign Another File")
                    }
                }
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Draw Signature in Pad below", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    
                    // Signature pad canvas view
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
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = { pdfUri = null },
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.outline),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Swap File")
                        }

                        Button(
                            onClick = {
                                isProcessing = true
                                scope.launch(Dispatchers.IO) {
                                    try {
                                        // Package raw canvas points as signature bitmap resource
                                        val signatureBmp = Bitmap.createBitmap(400, 200, Bitmap.Config.ARGB_8888)
                                        signatureBmp.eraseColor(android.graphics.Color.WHITE)
                                        val signatureCanvas = android.graphics.Canvas(signatureBmp)
                                        val signaturePaint = android.graphics.Paint().apply {
                                            color = android.graphics.Color.BLACK
                                            strokeWidth = 10f
                                            style = android.graphics.Paint.Style.STROKE
                                        }

                                        if (pathPoints.isNotEmpty()) {
                                            val signaturePath = android.graphics.Path()
                                            signaturePath.moveTo(pathPoints[0].x / 2, pathPoints[0].y / 4)
                                            for (i in 1 until pathPoints.size) {
                                                signaturePath.lineTo(pathPoints[i].x / 2, pathPoints[i].y / 4)
                                            }
                                            signatureCanvas.drawPath(signaturePath, signaturePaint)
                                        }

                                        val docStream: InputStream? = context.contentResolver.openInputStream(pdfUri!!)
                                        docStream?.use { input ->
                                            val document = PDDocument.load(input)
                                            val imageXObject = JPEGFactory.createFromImage(document, signatureBmp)
                                            
                                            // Embed vector signature on first page footer
                                            if (document.numberOfPages > 0) {
                                                val page = document.getPage(0)
                                                val contentStream = PDPageContentStream(
                                                    document, page, 
                                                    PDPageContentStream.AppendMode.APPEND, 
                                                    true, true
                                                )
                                                // Place on bottom right coordinates of page
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
                                        }
                                    } catch (e: Exception) {
                                        e.printStackTrace()
                                        withContext(Dispatchers.Main) {
                                            isProcessing = false
                                        }
                                    }
                                }
                            },
                            enabled = pathPoints.isNotEmpty(),
                            modifier = Modifier.weight(2f),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Apply Signature to PDF")
                        }
                    }
                }
            }
        }
    }
}
