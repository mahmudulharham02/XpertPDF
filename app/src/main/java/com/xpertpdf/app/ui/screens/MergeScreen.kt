package com.xpertpdf.app.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.MergeType
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
import com.tom_roush.pdfbox.multipdf.PDFMergerUtility
import com.xpertpdf.app.utils.Localization
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MergeScreen(
    navController: NavController,
    language: String
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var selectedFileUris by remember { mutableStateOf<List<Uri>>(emptyList()) }
    var mergedFile: File? by remember { mutableStateOf(null) }
    var isProcessing by remember { mutableStateOf(false) }

    val pickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { uris: List<Uri> ->
        if (uris.isNotEmpty()) {
            selectedFileUris = selectedFileUris + uris
            mergedFile = null
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(Localization.translate(language, "merge"), fontWeight = FontWeight.SemiBold) },
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
            if (selectedFileUris.isEmpty() && mergedFile == null) {
                Button(
                    onClick = { pickerLauncher.launch("application/pdf") },
                    shape = RoundedCornerShape(16.dp),
                    contentPadding = PaddingValues(horizontal = 24.dp, vertical = 16.dp)
                ) {
                    Icon(imageVector = Icons.Default.Add, contentDescription = "Add Documents")
                    Spacer(modifier = Modifier.width(12.dp))
                    Text("Select PDF Files", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
            } else if (isProcessing) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Merging files...", style = MaterialTheme.typography.bodyMedium)
                }
            } else if (mergedFile != null) {
                // Success Screen
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.MergeType,
                        contentDescription = "Success",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Merge Successful!",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "File saved in internal app cache:\n${mergedFile?.name}",
                        fontSize = 14.sp,
                        color = Color.Gray,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(
                        onClick = {
                            selectedFileUris = emptyList()
                            mergedFile = null
                        },
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Merge More Files")
                    }
                }
            } else {
                // List Selected Files & Trigger Action
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
                        Text(
                            text = "Selected Files (${selectedFileUris.size})",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Row {
                            IconButton(onClick = { pickerLauncher.launch("application/pdf") }) {
                                Icon(imageVector = Icons.Default.Add, contentDescription = "Add Files", tint = MaterialTheme.colorScheme.primary)
                            }
                            IconButton(onClick = { selectedFileUris = emptyList() }) {
                                Icon(imageVector = Icons.Default.Clear, contentDescription = "Clear All", tint = MaterialTheme.colorScheme.error)
                            }
                        }
                    }

                    LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(selectedFileUris) { uri ->
                            Card(
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(imageVector = Icons.Default.MergeType, contentDescription = "PDF Document")
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Text(
                                        text = uri.lastPathSegment ?: "Unknown Source Document",
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 14.sp,
                                        modifier = Modifier.weight(1f)
                                    )
                                    IconButton(
                                        onClick = { selectedFileUris = selectedFileUris.filter { it != uri } }
                                    ) {
                                        Icon(imageVector = Icons.Default.Clear, contentDescription = "Remove Document", tint = Color.Gray)
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = {
                            isProcessing = true
                            scope.launch(Dispatchers.IO) {
                                try {
                                    val merger = PDFMergerUtility()
                                    val localTempFiles = mutableListOf<File>()

                                    for (uri in selectedFileUris) {
                                        val tempInFile = File.createTempFile("merge_src_", ".pdf", context.cacheDir)
                                        val inputStream: InputStream? = context.contentResolver.openInputStream(uri)
                                        inputStream?.use { input ->
                                            FileOutputStream(tempInFile).use { output ->
                                                input.copyTo(output)
                                            }
                                        }
                                        merger.addSource(tempInFile)
                                        localTempFiles.add(tempInFile)
                                    }

                                    val outFile = File(context.cacheDir, "merged_output_${System.currentTimeMillis()}.pdf")
                                    merger.destinationFileName = outFile.absolutePath
                                    merger.mergeDocuments(null)

                                    // Safely clean up temporary files
                                    localTempFiles.forEach { it.delete() }

                                    withContext(Dispatchers.Main) {
                                        mergedFile = outFile
                                        isProcessing = false
                                    }
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                    withContext(Dispatchers.Main) {
                                        isProcessing = false
                                    }
                                }
                            }
                        },
                        enabled = selectedFileUris.size >= 2,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(text = "Combine Documents", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
