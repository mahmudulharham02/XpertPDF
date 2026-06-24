package com.xpertpdf.app.ui.components

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.documentfile.provider.DocumentFile
import com.xpertpdf.app.managers.SessionManager
import com.xpertpdf.app.managers.StorageFile
import com.xpertpdf.app.managers.StorageManager
import java.io.File

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun FileBrowser(
    title: String = "Select PDF File",
    multiSelect: Boolean = false,
    allowedTypes: List<String> = emptyList(), // e.g. "pdf", "image", "doc", etc.
    onFilesSelected: (List<StorageFile>) -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val sessionManager = remember { SessionManager.getInstance(context) }
    
    // State
    var currentLocalFolder by remember { mutableStateOf<File>(
        sessionManager.getLastSelectedFolder()?.let { File(it) } ?: Environment.getExternalStorageDirectory()
    )}
    var activeSapUri by remember { mutableStateOf<Uri?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    var sortBy by remember { mutableStateOf("name") } // name, size, date
    var filterType by remember { mutableStateOf(if (allowedTypes.contains("pdf")) "pdf" else "all") } // all, pdf, image, doc, xls, ppt, txt
    
    // Selected files for multi-select
    val selectedFiles = remember { mutableStateListOf<StorageFile>() }
    
    // File listing
    var filesList by remember { mutableStateOf<List<StorageFile>>(emptyList()) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var hasStoragePermission by remember { mutableStateOf(StorageManager.hasPermissions(context)) }

    // SAF directory launcher
    val safLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocumentTree()
    ) { uri ->
        if (uri != null) {
            context.contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
            activeSapUri = uri
            sessionManager.setLastSelectedFolder(uri.toString())
        }
    }

    // Load files
    LaunchedEffect(currentLocalFolder, activeSapUri, searchQuery, sortBy, filterType, hasStoragePermission) {
        if (!hasStoragePermission) {
            errorMessage = "Storage Permissions are required to browse your device files."
            filesList = emptyList()
            return@LaunchedEffect
        }
        
        errorMessage = null
        val extensions = when (filterType) {
            "pdf" -> listOf("pdf")
            "image" -> listOf("jpg", "jpeg", "png", "webp", "gif", "bmp")
            "doc" -> listOf("doc", "docx", "rtf")
            "xls" -> listOf("xls", "xlsx", "csv")
            "ppt" -> listOf("ppt", "pptx")
            "txt" -> listOf("txt", "log", "md", "xml", "json")
            else -> emptyList()
        }

        try {
            if (activeSapUri != null) {
                filesList = StorageManager.listSapFolderFiles(
                    context = context,
                    treeUri = activeSapUri!!,
                    searchQuery = searchQuery,
                    sortBy = sortBy,
                    filterExtensions = extensions
                )
            } else {
                if (!currentLocalFolder.exists() || !currentLocalFolder.canRead()) {
                    // Fallback to app cache dir if internal storage is blocked due to Android 11+ scoped storage
                    currentLocalFolder = context.cacheDir
                }
                filesList = StorageManager.listLocalFolderFiles(
                    folder = currentLocalFolder,
                    searchQuery = searchQuery,
                    sortBy = sortBy,
                    filterExtensions = extensions
                )
                sessionManager.setLastSelectedFolder(currentLocalFolder.absolutePath)
            }
        } catch (e: Exception) {
            errorMessage = "Could not list files: ${e.localizedMessage}"
            filesList = emptyList()
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp),
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.background,
            tonalElevation = 6.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = onDismiss) {
                        Icon(imageVector = Icons.Default.Close, contentDescription = "Close")
                    }
                    Text(
                        text = title,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    if (multiSelect && selectedFiles.isNotEmpty()) {
                        Button(
                            onClick = { onFilesSelected(selectedFiles.toList()) },
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Done (${selectedFiles.size})", fontWeight = FontWeight.Bold)
                        }
                    } else {
                        Spacer(modifier = Modifier.width(48.dp))
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Search Bar
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search files...", fontSize = 14.sp) },
                    leadingIcon = { Icon(imageVector = Icons.Default.Search, contentDescription = "Search") },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(imageVector = Icons.Default.Clear, contentDescription = "Clear")
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = TextFieldDefaults.outlinedTextFieldColors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                    ),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Folder Shortcuts List
                Text(
                    text = "Shortcut Locations",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                    modifier = Modifier.padding(bottom = 6.dp)
                )

                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    item {
                        // SAF custom folder selector
                        AssistChip(
                            onClick = { safLauncher.launch(null) },
                            label = { Text("Select Folder (SAF)") },
                            leadingIcon = { Icon(imageVector = Icons.Default.FolderOpen, contentDescription = "SAF") },
                            colors = AssistChipDefaults.assistChipColors(
                                labelColor = MaterialTheme.colorScheme.primary
                            )
                        )
                    }

                    val nativeDirs = StorageManager.getNativeShortcutDirectories(context)
                    items(nativeDirs) { (name, dir) ->
                        val isSelected = activeSapUri == null && currentLocalFolder.absolutePath == dir.absolutePath
                        FilterChip(
                            selected = isSelected,
                            onClick = {
                                activeSapUri = null
                                currentLocalFolder = dir
                            },
                            label = { Text(name) },
                            leadingIcon = {
                                Icon(
                                    imageVector = if (isSelected) Icons.Default.Check else Icons.Default.Folder,
                                    contentDescription = name
                                )
                            }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Extension Filtering and Sorting Chips
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Sort Select
                    Box {
                        var expandedSort by remember { mutableStateOf(false) }
                        AssistChip(
                            onClick = { expandedSort = true },
                            label = { Text("Sort: ${sortBy.capitalize()}") },
                            leadingIcon = { Icon(imageVector = Icons.Default.Sort, contentDescription = "Sort") }
                        )
                        DropdownMenu(
                            expanded = expandedSort,
                            onDismissRequest = { expandedSort = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("Name") },
                                onClick = { sortBy = "name"; expandedSort = false }
                            )
                            DropdownMenuItem(
                                text = { Text("Size") },
                                onClick = { sortBy = "size"; expandedSort = false }
                            )
                            DropdownMenuItem(
                                text = { Text("Date") },
                                onClick = { sortBy = "date"; expandedSort = false }
                            )
                        }
                    }

                    // Filter Types
                    val filterChips = listOf("all", "pdf", "image", "doc", "xls", "ppt", "txt")
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        modifier = Modifier.weight(1f).padding(start = 8.dp)
                    ) {
                        items(filterChips) { filter ->
                            val isSelected = filterType == filter
                            val label = filter.toUpperCase()
                            FilterChip(
                                selected = isSelected,
                                onClick = { filterType = filter },
                                label = { Text(label, fontSize = 11.sp) }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Error Message / Permissions
                if (!hasStoragePermission) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Default.Security,
                            contentDescription = "PermissionRequired",
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Permission is required to view your device files",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = {
                                StorageManager.openAppSettings(context)
                                hasStoragePermission = StorageManager.hasPermissions(context)
                            }
                        ) {
                            Text("Grant Permission in Settings")
                        }
                    }
                } else if (errorMessage != null) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = errorMessage!!, color = MaterialTheme.colorScheme.error)
                    }
                } else if (filesList.isEmpty()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Default.InsertDriveFile,
                            contentDescription = "No Files",
                            tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f),
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "No files found",
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                            fontWeight = FontWeight.Bold
                        )
                    }
                } else {
                    // File List Column
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                    ) {
                        // Parent Navigation folder if local file
                        if (activeSapUri == null && currentLocalFolder.parentFile != null) {
                            item {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { currentLocalFolder = currentLocalFolder.parentFile!! }
                                        .padding(vertical = 8.dp, horizontal = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.ArrowBack,
                                        contentDescription = "Up",
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.padding(end = 12.dp)
                                    )
                                    Text(
                                        text = ".. (Parent Directory)",
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                                Divider(color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.2f))
                            }
                        }

                        items(filesList) { file ->
                            val isSelected = selectedFiles.any { it.path == file.path }
                            val icon = when {
                                file.isDirectory -> Icons.Default.Folder
                                file.fileExtension == "pdf" -> Icons.Default.PictureAsPdf
                                listOf("jpg", "jpeg", "png", "webp", "gif").contains(file.fileExtension) -> Icons.Default.Image
                                listOf("doc", "docx").contains(file.fileExtension) -> Icons.Default.Description
                                listOf("xls", "xlsx").contains(file.fileExtension) -> Icons.Default.GridOn
                                else -> Icons.Default.InsertDriveFile
                            }

                            val iconColor = when {
                                file.isDirectory -> Color(0xFFFBBC05)
                                file.fileExtension == "pdf" -> Color(0xFFEA4335)
                                listOf("jpg", "jpeg", "png").contains(file.fileExtension) -> Color(0xFF4285F4)
                                listOf("xls", "xlsx").contains(file.fileExtension) -> Color(0xFF34A853)
                                else -> MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                            }

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(
                                        if (isSelected) MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
                                        else Color.Transparent
                                    )
                                    .combinedClickable(
                                        onClick = {
                                            if (file.isDirectory) {
                                                if (file.isUriBased) {
                                                    activeSapUri = Uri.parse(file.path)
                                                } else {
                                                    currentLocalFolder = File(file.path)
                                                }
                                            } else {
                                                if (multiSelect) {
                                                    if (isSelected) {
                                                        selectedFiles.removeAll { it.path == file.path }
                                                    } else {
                                                        selectedFiles.add(file)
                                                    }
                                                } else {
                                                    onFilesSelected(listOf(file))
                                                }
                                            }
                                        },
                                        onLongClick = {
                                            if (!file.isDirectory && !multiSelect) {
                                                // auto toggle multi-select mode if available
                                            }
                                        }
                                    )
                                    .padding(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(42.dp)
                                        .clip(CircleShape)
                                        .background(iconColor.copy(alpha = 0.12f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = icon,
                                        contentDescription = file.name,
                                        tint = iconColor,
                                        modifier = Modifier.size(24.dp)
                                    )
                                }

                                Column(
                                    modifier = Modifier
                                        .weight(1f)
                                        .padding(start = 12.dp, end = 8.dp)
                                ) {
                                    Text(
                                        text = file.name,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onBackground,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    if (!file.isDirectory) {
                                        Text(
                                            text = "${file.formattedSize} • ${file.fileExtension.toUpperCase()}",
                                            fontSize = 11.sp,
                                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                                        )
                                    } else {
                                        Text(
                                            text = "Directory Folder",
                                            fontSize = 11.sp,
                                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                                        )
                                    }
                                }

                                if (multiSelect && !file.isDirectory) {
                                    Checkbox(
                                        checked = isSelected,
                                        onCheckedChange = { checked ->
                                            if (checked == true) {
                                                selectedFiles.add(file)
                                            } else {
                                                selectedFiles.removeAll { it.path == file.path }
                                            }
                                        }
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
