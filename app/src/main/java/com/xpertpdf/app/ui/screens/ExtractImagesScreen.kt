package com.xpertpdf.app.ui.screens

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.DownloadDone
import androidx.compose.material.icons.filled.UploadFile
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
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.graphics.image.PDImageXObject
import com.xpertpdf.app.utils.Localization
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.InputStream

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExtractImagesScreen(
    navController: NavController,
    language: String
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pdfUri by remember { mutableStateOf<Uri?>(null) }
    var extractedBitmaps by remember { mutableStateOf<List<Bitmap>>(emptyList()) }
    var isProcessing by remember { mutableStateOf(false) }

    val pickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            pdfUri = uri
            extractedBitmaps = emptyList()
            isProcessing = true
            scope.launch(Dispatchers.IO) {
                try {
                    val stream: InputStream? = context.contentResolver.openInputStream(uri)
                    stream?.use { input ->
                        val document = PDDocument.load(input)
                        val imageList = mutableListOf<Bitmap>()
                        
                        // Parse PDF document structure to seek embedded visual resources
                        for (page in document.pages) {
                            val resources = page.resources
                            for (name in resources.xObjectNames) {
                                val xobject = resources.getXObject(name)
                                if (xobject is PDImageXObject) {
                                    val bmp = xobject.image
                                    imageList.add(bmp)
                                }
                            }
                        }
                        
                        document.close()
                        withContext(Dispatchers.Main) {
                            extractedBitmaps = imageList
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
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(Localization.translate(language, "extractImages"), fontWeight = FontWeight.SemiBold) },
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
                // Selector
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
                    Text("Extracting embedded images...", style = MaterialTheme.typography.bodyMedium)
                }
            } else {
                // Done View
                if (extractedBitmaps.isEmpty()) {
                    Text("No embedded images detected inside PDF.", fontWeight = FontWeight.Medium, color = Color.Gray)
                } else {
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
                            Text("Extracted (${extractedBitmaps.size} assets)", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            IconButton(onClick = { pdfUri = null }) {
                                Icon(imageVector = Icons.Default.UploadFile, contentDescription = "New PDF")
                            }
                        }

                        LazyVerticalGrid(
                            columns = GridCells.Fixed(3),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(extractedBitmaps) { bitmap ->
                                Card(
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .aspectRatio(1f)
                                ) {
                                    Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                                        Image(
                                            bitmap = bitmap.asImageBitmap(),
                                            contentDescription = "Extracted Asset",
                                            modifier = Modifier.fillMaxSize()
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
}
