import {jsPDF} from 'jspdf';
import {sortReceipts,type StudentReceipt} from '@shared/payment-receipts';
const money=(value:string)=>`NGN ${Number(value).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
function day(value:string|null, time=false) {
  if(!value)return 'Not available';
  const date=new Date(value.length===10?`${value}T12:00:00Z`:value);
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',day:'2-digit',month:'short',year:'numeric',...(time?{hour:'2-digit',minute:'2-digit',hour12:false} as const:{})}).format(date)+(time?' WAT':'');
}
// Vector text avoids the tall-canvas limit when exporting large batches.
export function buildReceiptPdf(receipts:StudentReceipt[], logos:Map<string,string>=new Map()) {
  const pdf=new jsPDF({unit:'mm',format:'a4',compress:true});
  let slot=0;
  for(const receipt of sortReceipts(receipts)) {
    pdf.setFontSize(8);
    const lines=receipt.items.flatMap(item=>{
      const wrapped=pdf.splitTextToSize(item.purpose,140) as string[];
      return wrapped.map((text,i)=>({text,amount:i===0?money(item.amount):''}));
    });
    const parts=Math.max(1,Math.ceil(lines.length/5));
    for(let part=0;part<parts;part++) {
      if(slot&&slot%3===0)pdf.addPage();
      const y=10+(slot%3)*92;
      pdf.setTextColor(25,35,45);pdf.setDrawColor(190);
      const logo=logos.get(receipt.logoUrl||'/academy-logo.png');
      if(logo)pdf.addImage(logo,'PNG',12,y+2,13,13);
      const fit=(text:string,x:number,top:number,width:number,size=9)=>{
        let font=size;pdf.setFontSize(font);
        let rows=pdf.splitTextToSize(text,width) as string[];
        while(rows.length>2&&font>6){font-=0.5;pdf.setFontSize(font);rows=pdf.splitTextToSize(text,width);}
        pdf.text(rows,x,top,{lineHeightFactor:1.05});
      };
      pdf.setFont('helvetica','bold');fit(receipt.schoolName,logo?29:12,y+5,logo?166:183,11);
      pdf.setFont('helvetica','normal');pdf.setFontSize(8);
      pdf.text(`PAYMENT RECEIPT  ${receipt.number}${parts>1?`  (${part+1}/${parts})`:''}`,logo?29:12,y+15);
      pdf.line(12,y+18,198,y+18);
      pdf.setFont('helvetica','bold');fit(`${receipt.lastName} ${receipt.firstName} | ${receipt.studentCode}`,12,y+23,184,10);
      pdf.setFont('helvetica','normal');fit(`Class: ${receipt.className} | ${receipt.term} | ${receipt.session}`,12,y+32,184,8);
      fit(`Paid: ${day(receipt.paymentDate)} | Confirmed: ${day(receipt.confirmedAt,true)}`,12,y+40,184,8);
      fit(`Method: ${receipt.method} | Depositor: ${receipt.depositor}`,12,y+47,184,8);
      pdf.setFillColor(241,244,247);pdf.rect(12,y+52,186,5,'F');pdf.setFontSize(8);pdf.setFont('helvetica','bold');
      pdf.text(part?'PAYMENT BREAKDOWN (CONTINUED)':'PAYMENT BREAKDOWN',14,y+55.5);pdf.text('AMOUNT',196,y+55.5,{align:'right'});
      pdf.setFont('helvetica','normal');pdf.setFontSize(8);
      lines.slice(part*5,part*5+5).forEach((line,i)=>{pdf.text(line.text,14,y+61+i*3.4);pdf.text(line.amount,196,y+61+i*3.4,{align:'right'});});
      pdf.setFont('helvetica','bold');pdf.setFontSize(10);
      pdf.text(part===parts-1?`TOTAL RECEIVED FOR THIS STUDENT: ${money(receipt.total)}`:'Breakdown continues on the next slip - same receipt',12,y+79);
      pdf.setFont('helvetica','normal');fit(`Reference: ${receipt.reference||'Not supplied'} | Confirmed payment - retain for your records`,12,y+84,184,7);
      if(slot%3<2){pdf.setLineDashPattern([1,1],0);pdf.line(10,y+90,200,y+90);pdf.setLineDashPattern([],0);}
      slot++;
    }
  }
  pdf.setProperties({title:'Student payment receipts',subject:'Confirmed payments',creator:'Seat of Wisdom Academy'});
  return pdf;
}
export async function loadReceiptLogos(receipts:StudentReceipt[]) {
  const logos=new Map<string,string>();
  await Promise.all(Array.from(new Set(receipts.map(r=>r.logoUrl||'/academy-logo.png'))).map(async url=>{
    try {
      const image=new Image();image.crossOrigin='anonymous';
      await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Logo timed out')),5000);image.onload=()=>{clearTimeout(timer);resolve();};image.onerror=()=>{clearTimeout(timer);reject(new Error('Logo unavailable'));};image.src=url;});
      const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
      const ctx=canvas.getContext('2d')!;const scale=Math.min(160/image.width,160/image.height);
      ctx.drawImage(image,(160-image.width*scale)/2,(160-image.height*scale)/2,image.width*scale,image.height*scale);
      logos.set(url,canvas.toDataURL('image/png'));
    }catch{/* Keep the school name visible if its logo cannot be loaded. */}
  }));
  return logos;
}
