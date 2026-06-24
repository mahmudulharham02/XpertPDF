# PDFBox Android library keep rules
-keep class com.tom_roush.pdfbox.** { *; }
-keep class com.tom_roush.** { *; }

# JP2 classes (may not be available but don't fail if missing)
-dontwarn com.gemalto.jp2.**

# Keep Compose runtime
-keep class androidx.compose.** { *; }
-keep class androidx.compose.runtime.** { *; }

# Keep Android core classes
-keep class android.** { *; }

# Keep application classes
-keep class com.xpertpdf.** { *; }

# Generic rules
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
