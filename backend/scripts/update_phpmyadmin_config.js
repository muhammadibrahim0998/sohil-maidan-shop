import fs from 'fs';

const pmaPath = 'C:\\xamm20\\phpMyAdmin\\config.inc.php';

try {
  if (fs.existsSync(pmaPath)) {
    let content = fs.readFileSync(pmaPath, 'utf8');
    if (!content.includes('MaxTableList')) {
      const addition = "\n$cfg['MaxTableList'] = 250;\n$cfg['FirstLevelNavigationItems'] = 250;\n?>";
      content = content.replace('?>', addition);
      fs.writeFileSync(pmaPath, content, 'utf8');
      console.log('✅ phpMyAdmin config updated: MaxTableList = 250');
    } else {
      console.log('ℹ️ MaxTableList already present in phpMyAdmin config');
    }
  } else {
    console.log('⚠️ phpMyAdmin config not found at path');
  }
} catch (e) {
  console.error('Error updating config:', e.message);
}
