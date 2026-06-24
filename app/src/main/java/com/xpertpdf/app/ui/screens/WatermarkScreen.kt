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
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream
import com.tom_roush.pdfbox.pdmodel.font.PDType1Font
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
fun WatermarkScreen(
    navController: NavController,
    language: String
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pdfSource by remember { mutableStateOf<String?>(null) }
    var watermarkText by remember { mutableStateOf("XpertPDF Professional") }
    var resultFile: File? by remember { mutableStateOf(null) }
    var isProcessing by remember { mutableStateOf(false) }
    var isBrowserOpen by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(Localization.translate(language, "watermark"), fontWeight = FontWeight.ExtraBold) },
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
                        imageVector = Icons.Default.WaterDrop,
                        contentDescription = "Watermark",
                        tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.4f),
                        modifier = Modifier.size(92.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Add custom text watermark overlays to your PDF pages",
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
                    Text("Applying translucent watermark...", fontWeight = FontWeight.Bold)
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
                        text = "Watermark Applied Successfully!",
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
                            watermarkText = "XpertPDF Professional"
                        },
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Watermark Another File")
                    }
                }
            } else {
                // Configuration Screen
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Default.PictureAsPdf,
                        contentDescription = "PDF Source",
                        tint = Color(0xFFEA4335),
                        modifier = Modifier.size(72.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Configure Overlay Metadata", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                    Spacer(modifier = Modifier.height(16.dp))

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

                    OutlinedTextField(
                        value = watermarkText,
                        onValueChange = { watermarkText = it },
                        label = { Text("Watermark text label") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        singleLine = true
                    )

                    Spacer(modifier = Modifier.height(24.dp))

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
                                if (watermarkText.isEmpty()) {
                                    errorMessage = "Watermark text cannot be empty."
                                    return@Button
                                }
                                isProcessing = true
                                errorMessage = null
                                scope.launch(Dispatchers.IO) {
                                    try {
                                        // Validate
                                        val validation = PdfManager.validatePdf(context, pdfSource!!)
                                        if (!validation.first) {
                                            throw IllegalArgumentException(validation.second)
                                        }

                                        val document = PdfManager.openDocument(context, pdfSource!!)
                                        
                                        for (page in document.pages) {
                                            val font = PDType1Font.HELVETICA_BOLD
                                            val contentStream = PDPageContentStream(
                                                document, page,
                                                PDPageContentStream.AppendMode.APPEND,
                                                true, true
                                            )
                                            contentStream.beginText()
                                            contentStream.setFont(font, 36f)
                                            contentStream.setNonStrokingColor(220, 220, 220) // Neutral light gray
                                            
                                            contentStream.setTextMatrix(
                                                com.tom_roush.pdfbox.util.Matrix.getRotateInstance(
                                                    Math.toRadians(45.0),
                                                    150f,
                                                    300f
                                                )
                                            )
                                            contentStream.showText(watermarkText)
                                            contentStream.endText()
                                            contentStream.close()
                                        }

                                        val outFile = File(context.cacheDir, "watermarked_${System.currentTimeMillis()}.pdf")
                                        document.save(outFile)
                                        document.close()

                                        withContext(Dispatchers.Main) {
                                            resultFile = outFile
                                            isProcessing = false
                                        }
                                    } catch (t: Throwable) {
                                        t.printStackTrace()
                                        CrashManager.logCrash(context, "Watermark", t)
                                        withContext(Dispatchers.Main) {
                                            isProcessing = false
                                            errorMessage = "Failed to apply watermark. ${t.localizedMessage ?: "Make sure file is writeable."}"
                                        }
                                    }
                                }
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Apply Watermark")
                        }
                    }
                }
            }
        }
    }

    if (isBrowserOpen) {
        FileBrowser(
            title = "Select PDF for Watermark",
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
