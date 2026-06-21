package com.xpertpdf.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.xpertpdf.app.ui.screens.*
import com.xpertpdf.app.ui.theme.XpertPDFTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Initialize PDFBox for local Android environment resources
        com.tom_roush.pdfbox.android.PDFBoxResourceLoader.init(applicationContext)

        setContent {
            var isDarkTheme by remember { mutableStateOf(false) }
            var language by remember { mutableStateOf("en") }
            var font by remember { mutableStateOf("sans") }

            val customFontFamily = when (font) {
                "monospace" -> FontFamily.Monospace
                else -> FontFamily.SansSerif
            }

            XpertPDFTheme(darkTheme = isDarkTheme) {
                // Apply global font configuration using a simple composition update
                val currentTypography = MaterialTheme.typography.copy(
                    bodyLarge = MaterialTheme.typography.bodyLarge.copy(fontFamily = customFontFamily),
                    titleLarge = MaterialTheme.typography.titleLarge.copy(fontFamily = customFontFamily),
                    labelLarge = MaterialTheme.typography.labelLarge.copy(fontFamily = customFontFamily)
                )

                MaterialTheme(
                    colorScheme = MaterialTheme.colorScheme,
                    typography = currentTypography
                ) {
                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = MaterialTheme.colorScheme.background
                    ) {
                        val navController = rememberNavController()

                        NavHost(
                            navController = navController,
                            startDestination = "dashboard"
                        ) {
                            composable("dashboard") {
                                DashboardScreen(navController = navController, language = language)
                            }
                            composable("viewer") {
                                ViewerScreen(navController = navController, language = language)
                            }
                            composable("split") {
                                SplitScreen(navController = navController, language = language)
                            }
                            composable("merge") {
                                MergeScreen(navController = navController, language = language)
                            }
                            composable("encrypt") {
                                EncryptScreen(navController = navController, language = language)
                            }
                            composable("watermark") {
                                WatermarkScreen(navController = navController, language = language)
                            }
                            composable("pdfToImage") {
                                PdfToImageScreen(navController = navController, language = language)
                            }
                            composable("extractImages") {
                                ExtractImagesScreen(navController = navController, language = language)
                            }
                            composable("sign") {
                                SignScreen(navController = navController, language = language)
                            }
                            composable("scan") {
                                ScanScreen(navController = navController, language = language)
                            }
                            composable("settings") {
                                SettingsScreen(
                                    navController = navController,
                                    isDarkTheme = isDarkTheme,
                                    onThemeChange = { isDarkTheme = it },
                                    language = language,
                                    onLanguageChange = { language = it },
                                    font = font,
                                    onFontChange = { font = it }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
