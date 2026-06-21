package com.xpertpdf.app.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CallSplit
import androidx.compose.material.icons.filled.UploadFile
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
import com.xpertpdf.app.utils.Localization
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SplitScreen(
    navController: NavController,
    language: String
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pdfUri by remember { mutableStateOf<Uri?>(null) }
    var pageCount by remember { mutableStateOf(0) }
    var splitCount by remember { mutableStateOf<Int?>(null) }
    var isProcessing by remember { mutableStateOf(false) }

    val pickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            pdfUri = uri
            splitCount = null
            scope.launch(Dispatchers.IO) {
                try {
                    val stream: InputStream? = context.contentResolver.openInputStream(uri)
                    stream?.use { input ->
                        val document = PDDocument.load(input)
                        val count = document.numberOfPages
                        document.close()
                        withContext(Dispatchers.Main) {
                            pageCount = count
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(Localization.translate(language, "split"), fontWeight = FontWeight.SemiBold) },
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
                    Text("Splitting file pages into pieces...", style = MaterialTheme.typography.bodyMedium)
                }
            } else if (splitCount != null) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(24.dp)
                ) {
                    Icon(imageVector = Icons.Default.CallSplit, contentDescription = "Success", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(64.dp))
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Split Completed Successfully!", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Text("Extracted $splitCount individual page documents.", fontSize = 14.sp, color = Color.Gray, modifier = Modifier.padding(top = 8.dp))
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(onClick = { pdfUri = null }, shape = RoundedCornerShape(12.dp)) {
                        Text("Split Another File")
                    }
                }
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Analyze PDF Source Properties", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Detected page range: 1 to $pageCount", color = Color.Gray, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    Button(
                        onClick = {
                            isProcessing = true
                            scope.launch(Dispatchers.IO) {
                                try {
                                    val stream: InputStream? = context.contentResolver.openInputStream(pdfUri!!)
                                    stream?.use { input ->
                                        val document = PDDocument.load(input)
                                        val splitter = Splitter()
                                        
                                        // Split single pages out
                                        val pages = splitter.split(document)
                                        
                                        // Save files in cache directory
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
                        Text("Extract Individual Pages", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
