const fs = require('fs');
const pdfPath = 'C:\\Users\\ishan\\Downloads\\Kairo_Dental_Clinic_Dummy_Knowledge_Base.pdf';
const buf = fs.readFileSync(pdfPath);
const str = buf.toString('latin1');
console.log('PDF Header:', str.slice(0, 50));
console.log('Objects Count:', (str.match(/\/Type\s*\/Page\b/g) || []).length);
console.log('Filters:', str.match(/\/Filter\s*\/[a-zA-Z0-9]+/g));
console.log('Streams Count:', (str.match(/stream/g) || []).length);

// Check if objects are indexed in XRef or ObjStm
console.log('Has ObjStm:', str.includes('/ObjStm'));
console.log('Has XRef Stream:', str.includes('/XRef'));

// Let's print out the first 500 chars of stream headers
const streamMatches = str.match(/<<[\s\S]*?>>\s*stream/g) || [];
console.log('First 3 Stream Dictionaries:');
streamMatches.slice(0, 3).forEach((d, i) => console.log(`[Stream ${i}]:\n`, d));
