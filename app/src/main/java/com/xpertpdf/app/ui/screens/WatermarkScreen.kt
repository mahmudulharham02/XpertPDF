package com.xpertpdf.app.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material.icons.filled.WaterDrop
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
import com.xpertpdf.app.utils.Localization
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WatermarkScreen(
    navController: NavController,
    language: String
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pdfUri by remember { mutableStateOf<Uri?>(null) }
    var watermarkText by remember { mutableStateOf("XpertPDF Professional") }
    var resultFile: File? by remember { mutableStateOf(null) }
    var isProcessing by remember { mutableStateOf(false) }

    val pickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            pdfUri = uri
            resultFile = null
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(Localization.translate(language, "watermark"), fontWeight = FontWeight.SemiBold) },
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
                    Text("Applying watermark overlay...", style = MaterialTheme.typography.bodyMedium)
                }
            } else if (resultFile != null) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(24.dp)
                ) {
                    Icon(imageVector = Icons.Default.WaterDrop, contentDescription = "Success", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(64.dp))
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Watermark Overlay Applied!", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Text("Saved to cache:\n${resultFile?.name}", fontSize = 14.sp, color = Color.Gray, modifier = Modifier.padding(top = 8.dp))
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(onClick = { pdfUri = null }, shape = RoundedCornerShape(12.dp)) {
                        Text("Add to Another File")
                    }
                }
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Configure Overlay Metadata", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                    
                    OutlinedTextField(
                        value = watermarkText,
                        onValueChange = { watermarkText = it },
                        label = { Text("Watermark text label") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = {
                            isProcessing = true
                            scope.launch(Dispatchers.IO) {
                                try {
                                    val stream: InputStream? = context.contentResolver.openInputStream(pdfUri!!)
                                    stream?.use { input ->
                                        val document = PDDocument.load(input)
                                        
                                        // Set text overlay settings on all pages
                                        for (page in document.pages) {
                                            val font = PDType1Font.HELVETICA_BOLD
                                            val contentStream = PDPageContentStream(
                                                document, page, 
                                                PDPageContentStream.AppendMode.APPEND, 
                                                true, true
                                            )
                                            contentStream.beginText()
                                            contentStream.setFont(font, 36f)
                                            contentStream.setNonStrokingColor(220, 220, 220) // Neutral light gray transparent color
                                            
                                            // Centered angle position metrics
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
                                    }
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                    withContext(Dispatchers.Main) {
                                        isProcessing = false
                                    }
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Apply Translucent Watermark", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
