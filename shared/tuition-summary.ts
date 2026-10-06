export function summarizeTuition(entries: Array<{tuitionAssigned:number;tuitionPaid:number;tuitionKnown:boolean;studentType?:string}>) {
  let expected=0, confirmed=0, collected=0, outstanding=0, studentsOwing=0, unverified=0;
  const typeBreakdown={new:{totalFees:0,actualCollected:0,studentsOwing:0},returning:{totalFees:0,actualCollected:0,studentsOwing:0}};
  for(const entry of entries){
    const paid=Math.round((entry.tuitionPaid||0)*100);
    confirmed+=paid;
    if(!entry.tuitionKnown){unverified++;continue;}
    const due=Math.round((entry.tuitionAssigned||0)*100);
    const applied=Math.min(paid,due), balance=Math.max(0,due-paid);
    expected+=due;collected+=applied;outstanding+=balance;
    if(balance>0) studentsOwing++;
    const group=typeBreakdown[entry.studentType==='new'?'new':'returning'];
    group.totalFees+=due;group.actualCollected+=applied;if(balance>0)group.studentsOwing++;
  }
  for(const group of Object.values(typeBreakdown)){group.totalFees/=100;group.actualCollected/=100;}
  return {totalFees:expected/100,totalPaid:confirmed/100,actualTuitionCollected:collected/100,totalOutstanding:outstanding/100,studentsOwing,collectionRate:expected>0?Math.round(collected/expected*100):0,tuitionUnverifiedCount:unverified,typeBreakdown};
}
