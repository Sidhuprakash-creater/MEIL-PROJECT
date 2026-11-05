// Repairs the syntax damage from the seed-removal splices.
const { readFileSync, writeFileSync } = require('node:fs')

function patch(p, fn) {
  let t = readFileSync(p, 'utf8')
  const nt = fn(t)
  if (nt === t) { console.error('NO CHANGE:', p); process.exit(1) }
  writeFileSync(p, nt)
  console.log('patched', p)
}

// L3: re-add the useState closer that the splice consumed
patch('src/components/shared/data-entry/forms/level3-ghg.tsx', (t) =>
  t.replace(
    "    // Blank until the user stages an item (draft restores keep saved data)\n    return []\n\n\n  // View step",
    "    // Blank until the user stages an item (draft restores keep saved data)\n    return []\n  })\n\n  // View step",
  ),
)

// L2 interface: unglue lines and drop removed fields
patch('src/components/shared/data-entry/forms/level2-water.tsx', (t) =>
  t
    .replace('    unit: string    reused: string\n', '    unit: string\n')
    .replace('    treatment: string    testLab: string\n', '    treatment: string\n')
    .replace('    icon: LucideIcon  }', '    icon: LucideIcon\n  }'),
)

// L3 interface: unglue and drop removed fields
patch('src/components/shared/data-entry/forms/level3-ghg.tsx', (t) =>
  t
    .replace('  pollutant: string  equipmentId: string  method: string\n', '  pollutant: string\n  method: string\n')
    .replace('  icon: LucideIcon  defaultResult: string\n', '  icon: LucideIcon\n'),
)

// L4: re-add the useState closer if missing
{
  const p = 'src/components/shared/data-entry/forms/level4-waste.tsx'
  const t = readFileSync(p, 'utf8')
  const marker = "    // Blank until the user stages an item\n    return []\n"
  if (t.includes(marker)) {
    const after = t.slice(t.indexOf(marker) + marker.length, t.indexOf(marker) + marker.length + 12)
    if (!after.startsWith('  })')) {
      patch(p, (tt) => tt.replace(marker + '\n', marker + '  })\n'))
    } else {
      console.log('L4 closer already present')
    }
  } else {
    console.log('L4 marker not found — checking manually')
  }
}
console.log('done')
