package com.xpertpdf.app.utils

object Localization {
    private val translations = mapOf(
        "en" to mapOf(
            "viewer" to "PDF Viewer",
            "select_pdf" to "Select PDF File",
            "settings" to "Settings",
            "extractImages" to "Extract Images",
            "pdfToImage" to "PDF to Image",
            "merge" to "Merge PDFs",
            "split" to "Split PDF",
            "watermark" to "Add Watermark",
            "encrypt" to "Encrypt PDF",
            "sign" to "Sign PDF",
            "scan" to "Scan Document",
            "dashboard" to "Dashboard"
        ),
        "es" to mapOf(
            "viewer" to "Visor de PDF",
            "select_pdf" to "Seleccionar PDF",
            "settings" to "Configuración",
            "extractImages" to "Extraer Imágenes",
            "pdfToImage" to "PDF a Imagen",
            "merge" to "Fusionar PDFs",
            "split" to "Dividir PDF",
            "watermark" to "Añadir Marca de Agua",
            "encrypt" to "Cifrar PDF",
            "sign" to "Firmar PDF",
            "scan" to "Escanear Documento",
            "dashboard" to "Tablero"
        ),
        "fr" to mapOf(
            "viewer" to "Lecteur PDF",
            "select_pdf" to "Sélectionner un PDF",
            "settings" to "Paramètres",
            "extractImages" to "Extraire des Images",
            "pdfToImage" to "PDF en Image",
            "merge" to "Fusionner les PDF",
            "split" to "Diviser le PDF",
            "watermark" to "Ajouter un Filigrane",
            "encrypt" to "Chiffrer le PDF",
            "sign" to "Signer le PDF",
            "scan" to "Scanner un Document",
            "dashboard" to "Tableau de Bord"
        )
    )

    fun translate(language: String, key: String): String {
        val langMap = translations[language] ?: translations["en"]!!
        return langMap[key] ?: key
    }
}
