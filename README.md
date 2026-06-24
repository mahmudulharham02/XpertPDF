# 📄 XpertPDF

> A comprehensive, feature-rich PDF reader, extractor, and conversion tool with advanced document processing capabilities.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square)
![Repository](https://img.shields.io/badge/GitHub-mahmudulharham02/XpertPDF-blue?style=flat-square)

---

## ✨ Features

### 📖 Core Functionality
- **📄 PDF Reader & Viewer** - Open and view PDF documents with smooth rendering
- **🔍 PDF Text Extraction** - Extract text content from PDFs with precision
- **📋 PDF Metadata Extraction** - Retrieve document properties and information
- **📑 PDF Merge & Split** - Combine multiple PDFs or split pages

### 🎨 Image Processing
- **🖼️ Image to PDF Conversion** - Convert images (JPG, PNG, etc.) to PDF format
- **📷 PDF to Image Conversion** - Export PDF pages as individual images
- **🎯 Batch Processing** - Process multiple files efficiently
- **📐 Image Compression** - Optimize file sizes during conversion

### ✍️ Document Security & Signing
- **🔐 Digital Document Signing** - Add digital signatures to PDFs
- **✅ Image Annotation** - Mark and annotate images before conversion
- **🛡️ Document Metadata Management** - Add/edit document properties

### ⚙️ Advanced Features
- **🔧 PDF Editing** - Modify document content and structure
- **🎨 Batch Operations** - Process multiple documents at once
- **📊 Format Support** - Works with various image and document formats
- **⚡ Performance Optimized** - Fast processing for large files

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v16 or higher)
- **npm** or **yarn** package manager
- **TypeScript** knowledge (optional for development)

### Installation

```bash
# Clone the repository
git clone https://github.com/mahmudulharham02/XpertPDF.git
cd XpertPDF

# Install dependencies
npm install
# or
yarn install
```

### Basic Usage

```typescript
import XpertPDF from './path/to/xpertpdf';

// Initialize XpertPDF
const pdf = new XpertPDF();

// Extract text from PDF
const textContent = await pdf.extractText('document.pdf');
console.log(textContent);

// Convert image to PDF
await pdf.imageToPDF(['image1.jpg', 'image2.png'], 'output.pdf');

// Convert PDF to images
await pdf.pdfToImages('document.pdf', './output-images');

// Merge multiple PDFs
await pdf.mergePDFs(['file1.pdf', 'file2.pdf'], 'merged.pdf');

// Sign document
await pdf.signDocument('document.pdf', {
  signature: 'Your Signature',
  date: new Date()
}, 'signed-document.pdf');
```

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---
<div>
  
**Made with ❤️ by [mahmudulharham02](https://github.com/mahmudulharham02)**

[⬆ Back to top](#-xpertpdf)

</div>
