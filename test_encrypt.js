const { PDFDocument } = require('pdf-lib-plus-encrypt');
const fs = require('fs');

async function test() {
  const doc = await PDFDocument.create();
  doc.addPage();
  const options = {
    userPassword: '123'
  };
  await doc.encrypt(options);
  const bytes = await doc.save();
  // Try to load it
  try {
     const loaded = await PDFDocument.load(bytes, { password: '123' });
     console.log("Decrypted successfully using password option");
  } catch(e) {
     console.log("Load failed:", e.message);
  }
}
test();
