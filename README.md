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

## 📦 Installation Methods

### NPM
```bash
npm install xpertpdf
```

### Yarn
```bash
yarn add xpertpdf
```

### From Source
```bash
git clone https://github.com/mahmudulharham02/XpertPDF.git
npm install
npm run build
```

### APK for Android
Download the latest APK from [Releases](https://github.com/mahmudulharham02/XpertPDF/releases)

---

## 📖 API Reference

### Core Methods

#### `extractText(filePath: string): Promise<string>`
Extract all text content from a PDF file.

```typescript
const text = await pdf.extractText('document.pdf');
```

#### `imageToPDF(images: string[], outputPath: string): Promise<void>`
Convert one or more images to a PDF document.

```typescript
await pdf.imageToPDF(['image1.jpg', 'image2.png'], 'output.pdf');
```

#### `pdfToImages(filePath: string, outputDir: string): Promise<string[]>`
Convert PDF pages to individual image files.

```typescript
const imagePaths = await pdf.pdfToImages('document.pdf', './images');
```

#### `mergePDFs(files: string[], outputPath: string): Promise<void>`
Merge multiple PDF files into one.

```typescript
await pdf.mergePDFs(['file1.pdf', 'file2.pdf', 'file3.pdf'], 'merged.pdf');
```

#### `splitPDF(filePath: string, pages: number[], outputDir: string): Promise<string[]>`
Extract specific pages from a PDF.

```typescript
const pages = await pdf.splitPDF('document.pdf', [1, 3, 5], './split-pages');
```

#### `signDocument(filePath: string, signatureData: object, outputPath: string): Promise<void>`
Add a digital signature to a PDF document.

```typescript
await pdf.signDocument('document.pdf', {
  signature: 'Your Signature',
  date: new Date(),
  reason: 'Approval'
}, 'signed.pdf');
```

---

## 🛠️ Development

### Build Project
```bash
npm run build
```

### Run Tests
```bash
npm test
```

### Development Server
```bash
npm run dev
```

### Code Formatting
```bash
npm run format
```

---

## 📁 Project Structure

```
XpertPDF/
├── src/
│   ├── core/              # Core PDF processing logic
│   ├── converters/        # Image and format converters
│   ├── extractors/        # Text and metadata extraction
│   ├── signers/           # Digital signing functionality
│   └── utils/             # Utility functions
├── tests/                 # Unit and integration tests
├── docs/                  # Documentation
├── examples/              # Usage examples
├── README.md              # This file
├── package.json           # Project dependencies
└── tsconfig.json          # TypeScript configuration
```

---

## 💡 Examples

### Example 1: Extract Text and Save
```typescript
const text = await pdf.extractText('resume.pdf');
const fs = require('fs');
fs.writeFileSync('extracted-text.txt', text);
```

### Example 2: Convert Multiple Images to Single PDF
```typescript
const images = ['photo1.jpg', 'photo2.jpg', 'photo3.jpg'];
await pdf.imageToPDF(images, 'photo-album.pdf');
```

### Example 3: Batch Process PDFs
```typescript
const files = ['doc1.pdf', 'doc2.pdf', 'doc3.pdf'];
for (const file of files) {
  const text = await pdf.extractText(file);
  console.log(`Processed: ${file}`);
}
```

### Example 4: Digital Signing Workflow
```typescript
const originalFile = 'contract.pdf';
const signedFile = 'contract-signed.pdf';

await pdf.signDocument(originalFile, {
  signature: 'John Doe',
  date: new Date(),
  reason: 'Contract Approval'
}, signedFile);

console.log(`Document signed and saved to: ${signedFile}`);
```

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Guidelines
- Follow the existing code style
- Add tests for new features
- Update documentation
- Keep commits descriptive

---

## 🐛 Bug Reports & Feature Requests

Found a bug? Have a feature idea? Please open an [Issue](https://github.com/mahmudulharham02/XpertPDF/issues) with:
- Clear description of the problem/feature
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Your environment (OS, Node version, etc.)

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Support

If you find XpertPDF helpful, please consider:
- ⭐ **Starring** the repository
- 🔗 **Sharing** with your network
- 📝 **Contributing** improvements
- 💬 **Providing feedback** via issues

---

## 📞 Contact & Links

- **GitHub**: [@mahmudulharham02](https://github.com/mahmudulharham02)
- **Repository**: [XpertPDF](https://github.com/mahmudulharham02/XpertPDF)
- **Issues**: [Report Issues](https://github.com/mahmudulharham02/XpertPDF/issues)
- **Releases**: [Download APKs](https://github.com/mahmudulharham02/XpertPDF/releases)

---

## 🎯 Roadmap

- [ ] Web-based UI
- [ ] Cloud storage integration
- [ ] Advanced PDF compression
- [ ] OCR (Optical Character Recognition)
- [ ] PDF password protection
- [ ] Real-time collaboration features
- [ ] Mobile app improvements
- [ ] API server deployment

---

## 📚 Additional Resources

- [PDF Specifications](https://en.wikipedia.org/wiki/PDF)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Node.js Guide](https://nodejs.org/en/docs/)

---

<div align="center">

**Made with ❤️ by [mahmudulharham02](https://github.com/mahmudulharham02)**

[⬆ Back to top](#-xpertpdf)

</div>

<p align="center">
  <a href="https://github.com/user-attachments/assets/febbc095-3a2f-4942-9b65-984b50cc926f">
    <img src="https://github.com/user-attachments/assets/febbc095-3a2f-4942-9b65-984b50cc926f" width="250">
  </a>

  <a href="https://github.com/user-attachments/assets/cd31aabb-9673-4948-88e6-ad9b3871a7cb">
    <img src="https://github.com/user-attachments/assets/cd31aabb-9673-4948-88e6-ad9b3871a7cb" width="250">
  </a>
</p>


