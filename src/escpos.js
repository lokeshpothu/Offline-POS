// Minimal ESC/POS builder (demo) – can be sent to a real thermal printer later.
export function escposReceipt({ header, lines, total, footer }){
  const cmds = [];
  const LF = '\n';
  cmds.push('\x1B\x40'); // init
  cmds.push('\x1B\x61\x01'); // center
  cmds.push(header + LF + LF);
  cmds.push('\x1B\x61\x00'); // left
  for (const l of lines){
    cmds.push(`${l.name}  x${l.qty}  ${l.price.toFixed(2)}${LF}`);
    if (l.note) cmds.push(`  * ${l.note}${LF}`);
  }
  cmds.push(LF + 'TOTAL: ' + total.toFixed(2) + LF);
  cmds.push(LF + footer + LF);
  cmds.push('\x1D\x56\x00'); // cut
  return cmds.join('');
}
