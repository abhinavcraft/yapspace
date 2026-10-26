import {writeFileSync,mkdirSync} from 'node:fs';

const templates=[
  {file:'recovery',subject:'A fresh start for your YapSpace password',preheader:'Reset your password and find your way back to your people.',eyebrow:'A WAY BACK IN',heading:'A fresh start.<br>Same little space.',intro:'Forgot your password? It happens. Choose a new one and get back to the conversations that matter.',button:'Reset my password',noteTitle:'Wasn’t you?',note:'You can safely ignore this email. Your password will stay the same unless you complete the reset.',closing:'Your people will be right where you left them.'},
  {file:'confirmation',subject:'Your people. Your space. Confirm your email.',preheader:'One little step before your first hello. Welcome to YapSpace.',eyebrow:'YOUR NEXT HELLO STARTS HERE',heading:'Your people.<br>Your space.',intro:'Welcome to YapSpace, a little corner for good conversations. Confirm your email address to finish setting up your account.',button:'Confirm my email',noteTitle:'A little peace of mind.',note:'If you didn’t create a YapSpace account, you can ignore this email. There’s nothing else you need to do.',closing:'A good conversation starts with hello.'}
];

function render(t){return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${t.subject}</title>
  <style>
    @media only screen and (max-width:600px){.outer{padding:20px 12px!important}.content{padding:32px 24px!important}.brand-header{padding:25px 24px!important}.headline{font-size:34px!important;line-height:40px!important}.footer{padding:24px!important}.fallback{font-size:11px!important}}
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#f1f0f7;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;color:#f1f0f7;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${t.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f0f7" style="width:100%;border-collapse:collapse;">
    <tr><td class="outer" align="center" style="padding:48px 20px;">
      <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;border-collapse:separate;border-spacing:0;">
        <tr><td bgcolor="#191a24" style="height:5px;line-height:5px;font-size:1px;background-color:#a69aff;border-radius:18px 18px 0 0;">&nbsp;</td></tr>
        <tr><td class="brand-header" bgcolor="#191a24" style="padding:29px 38px;background-color:#191a24;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-1.2px;line-height:36px;">YapSpace<span style="color:#b1a5ff;">.</span></td>
            <td align="right" style="color:#bdb6dc;font-size:10px;line-height:17px;letter-spacing:1.2px;">LESS NOISE.<br>MORE CONNECTION.</td>
          </tr></table>
        </td></tr>
        <tr><td class="content" bgcolor="#ffffff" style="padding:40px 38px 34px;background-color:#ffffff;border-left:1px solid #e4e1ee;border-right:1px solid #e4e1ee;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" width="50" height="50" bgcolor="#efecff" style="width:50px;height:50px;border-radius:15px;background-color:#efecff;color:#715bd0;font-size:26px;line-height:50px;font-weight:bold;">&#10022;</td></tr></table>
          <p style="margin:27px 0 13px;color:#7763c7;font-size:10px;font-weight:bold;letter-spacing:2px;line-height:18px;">${t.eyebrow}</p>
          <h1 class="headline" style="margin:0 0 20px;color:#252333;font-family:Arial,Helvetica,sans-serif;font-size:39px;line-height:45px;font-weight:800;letter-spacing:-1.7px;">${t.heading}</h1>
          <p style="margin:0 0 28px;color:#696576;font-size:15px;line-height:25px;">${t.intro}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:0 0 29px;">
            <!--[if mso]><v:roundrect href="{{ .ConfirmationURL }}" style="height:52px;v-text-anchor:middle;width:226px;" arcsize="20%" strokecolor="#715bd0" fillcolor="#715bd0"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">${t.button}</center></v:roundrect><![endif]-->
            <!--[if !mso]><!--><a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;width:226px;box-sizing:border-box;border:1px solid #715bd0;border-radius:11px;background-color:#715bd0;color:#ffffff;font-size:15px;font-weight:bold;line-height:22px;padding:14px 15px;text-align:center;text-decoration:none;-webkit-text-size-adjust:none;">${t.button}&nbsp; &#8594;</a><!--<![endif]-->
          </td></tr></table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f5fa" style="width:100%;background-color:#f6f5fa;border-radius:11px;"><tr><td style="padding:18px 20px;border-left:3px solid #b5a8f4;">
            <p style="margin:0 0 6px;color:#494252;font-size:12px;font-weight:bold;line-height:19px;">${t.noteTitle}</p>
            <p style="margin:0;color:#70697c;font-size:12px;line-height:20px;">${t.note}</p>
          </td></tr></table>
          <p style="margin:27px 0 8px;color:#716a7a;font-size:11px;line-height:19px;">Button not opening? Copy this secure link into your browser:</p>
          <p class="fallback" style="margin:0;font-size:11px;line-height:19px;word-break:break-all;overflow-wrap:anywhere;"><a href="{{ .ConfirmationURL }}" style="color:#7763c7;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">{{ .ConfirmationURL }}</a></p>
        </td></tr>
        <tr><td class="footer" align="center" bgcolor="#faf9fd" style="padding:25px 30px;background-color:#faf9fd;border:1px solid #e4e1ee;border-top:1px solid #eeebf4;border-radius:0 0 18px 18px;">
          <p style="margin:0 0 8px;color:#575061;font-size:12px;font-weight:bold;line-height:20px;">${t.closing}</p>
          <p style="margin:0;color:#716a7a;font-size:11px;line-height:19px;">Made for your circle. Sent by YapSpace.<br><a href="https://yapspace.lol/" style="color:#7763c7;text-decoration:none;">yapspace.lol</a></p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
      <p style="margin:23px 0 0;color:#716a7a;font-size:10px;line-height:18px;">Keep this account link private. It belongs to you.</p>
    </td></tr>
  </table>
</body>
</html>
`;}

mkdirSync('supabase/email-templates',{recursive:true});
for(const template of templates)writeFileSync('supabase/email-templates/'+template.file+'.html',render(template));
writeFileSync('supabase/email-templates/subjects.json',JSON.stringify(Object.fromEntries(templates.map(t=>[t.file,t.subject])),null,2)+'\n');
const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const preview=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>YapSpace — branded email preview</title><style>body{margin:0;padding:32px;background:#e9e7f2;color:#252333;font:14px Arial,sans-serif}header{max-width:1160px;margin:0 auto 25px}h1{letter-spacing:-1px}p{color:#696576;line-height:1.7}.previews{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;max-width:1160px;margin:auto}h2{font-size:14px}iframe{display:block;border:1px solid #d8d3e8;border-radius:18px;width:100%;height:1050px;background:#f1f0f7}@media(max-width:900px){body{padding:20px 10px}.previews{grid-template-columns:1fr}}</style></head><body><header><h1>YapSpace email collection.</h1><p>Violet accents, a calm layout, and a little more personality. Preview buttons are inactive; the real templates retain Supabase’s secure links.</p></header><div class="previews">${templates.map(t=>`<section><h2>${t.file==='recovery'?'Password reset':'Email confirmation'}</h2><p>Subject: ${t.subject}</p><iframe sandbox="" title="${t.file} email preview" srcdoc="${escape(render(t).replaceAll('{{ .ConfirmationURL }}','https://yapspace.lol/'))}"></iframe></section>`).join('')}</div></body></html>`;
writeFileSync('E:/yapspace/YapSpace-email-preview.html',preview);
console.log('Generated two branded HTML templates, subjects, and the local preview.');
