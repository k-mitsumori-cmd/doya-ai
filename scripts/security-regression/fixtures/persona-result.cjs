module.exports = function makePersonaResult() {
  const texts = n => Array.from({length:n},(_,i)=>`Synthetic text ${i+1}`)
  return {
    persona: {
      name:'Synthetic', age:35, gender:'女性', occupation:'マーケティング担当', income:'500万円', location:'東京都',
      familyStructure:'一人暮らし', lifestyle:'平日は会社勤務', industry:'IT', companySize:'50名',
      challenges:texts(3),goals:texts(2),mediaUsage:texts(2),purchaseMotivation:texts(2),objections:texts(2),personalityTraits:texts(2),dayInLife:'Synthetic workday',quote:'Keep improving, } and ] stay literal.',
      painPoints:Array.from({length:5},(_,i)=>({point:`Pain ${i}`,episode:`Episode ${i}`,...(i<3?{imagePrompt:`Office challenge ${i}`}:{})})),
      alternativeMethods:Array.from({length:3},(_,i)=>({method:`Method ${i}`,dissatisfaction:`Concern ${i}`})),
      informationGathering:Array.from({length:4},(_,i)=>({source:`Source ${i}`,behavior:`Read ${i}`})),
      triggerEvents:texts(3),resonatingMessages:texts(5),innerVoice:texts(5),
      schedule:Array.from({length:8},(_,i)=>({time:`${i+8}:00`,activity:`Activity ${i}`,detail:`Detail ${i}`,mood:'穏やか',...(i<3?{imagePrompt:`Scene ${i}`}:{})})),
      diary:{title:'Synthetic diary',content:'I completed my work today.',weather:'晴れ',imageScenes:['Office morning','Home evening']},
    },
    deepDive:{objectionAnalysis:Array.from({length:10},(_,i)=>({objection:`Concern ${i}`,reassurance:`Evidence ${i}`})),adoptionStory:{trigger:'Read a case study',competitors:texts(2),consultedPeople:'Manager',trialActivities:'Try the product',decidingFactor:'Quality',timeline:Array.from({length:6},(_,i)=>({phase:`Phase ${i}`,description:`Description ${i}`,imagePrompt:`Adoption scene ${i}`}))},dayWithService:'A productive working day.'},
    summary:{oneLiner:'Synthetic summary',topChallenges:Array.from({length:3},(_,i)=>({rank:i+1,challenge:`Challenge ${i}`,episode:`Episode ${i}`})),alternativesDissatisfaction:[{alternative:'Spreadsheet',dissatisfaction:'Manual work'}],customerJourney:Array.from({length:4},(_,i)=>({phase:`Phase ${i}`,description:`Description ${i}`})),decidingFactors:texts(3),catchphrases:texts(5),contentIdeas:Array.from({length:3},(_,i)=>({title:`Title ${i}`,description:`Description ${i}`}))},
    creatives:{catchphrases:texts(5),lpStructure:{hero:'Hero',problem:'Problem',solution:'Solution',benefits:texts(3),cta:'Try'},adCopy:{google:texts(2),meta:texts(2)},emailDraft:{subject:'Synthetic subject',body:'Synthetic body'}},
    marketingChecklist:[{category:'Research',items:[{task:'Review audience',priority:'high'}]}],
  }
}
