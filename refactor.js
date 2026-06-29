const fs = require('fs');
const file = 'src/components/AssetSheet.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { Camera, Upload, X, CheckCircle2, AlertCircle, Clock, Ban, ChevronLeft, ChevronRight, Edit, FileText, FileSpreadsheet, Paperclip } from 'lucide-react';",
  "import { Camera, Upload, X, CheckCircle2, AlertCircle, Clock, Ban, ChevronLeft, ChevronRight, Edit, FileText, FileSpreadsheet, Paperclip, Cpu, Monitor, Wifi, Users, ShoppingCart, Image as ImageIcon } from 'lucide-react';"
);

const editModeIndex = content.indexOf('  // EDIT MODE');

if (editModeIndex > -1) {
  const newEditMode = fs.readFileSync('replacement.txt', 'utf8');
  content = content.substring(0, editModeIndex) + newEditMode + '\n}\n';
  fs.writeFileSync(file, content);
  console.log('Successfully refactored AssetSheet.tsx');
} else {
  console.error('Could not find EDIT MODE section');
}
