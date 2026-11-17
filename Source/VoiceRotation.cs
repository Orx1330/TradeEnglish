using System.IO;
namespace TradeEnglish;
internal static class VoiceRotation {
 internal static readonly (string Id,string Label)[] Voices={
  ("eric","Eric · أمريكي واضح"),
  ("brian","Brian · رجل أعمال عميق ورزين"),
  ("george","George · سرد هادئ وعميق، بريطاني"),
  ("Rmv8zCb2IRE895dK1qWB","Voice 4 - Rmv8zC"),
  ("SAxJUlDKRc79XAyeWyMu","Voice 5 - SAxJUl"),
  ("Qbw4VpyUrHEG7NigKzty","Voice 6 - Qbw4Vp"),
  ("507tTFX0IPtqFzGd1CAL","Voice 7 - 507tTF"),
  ("4tRn1lSkEn13EVTuqb0g","Voice 8 - 4tRn1l")
 };
 internal static string AudioPath(string root,string id,string text)=>Path.Combine(root,id=="eric"?"":id,MainWindow.PackagedAudioName(text));
 internal static string Choose(IReadOnlyList<string> available,string previous,string preferred){
  if(available.Count==0)return "";
  if(preferred!="random"&&available.Contains(preferred))return preferred;
  var candidates=available.Where(v=>v!=previous).ToArray();
  return candidates.Length==0?available[0]:candidates[Random.Shared.Next(candidates.Length)];
 }
}
partial class MainWindow {
 string lastSpokenText="",lastPackVoice="";
 string SelectPackAudio(string text){
  var root=Path.Combine(AppContext.BaseDirectory,"Assets","Audio");
  var available=VoiceRotation.Voices.Select(v=>v.Id).Where(id=>File.Exists(VoiceRotation.AudioPath(root,id,text))).ToArray();
  if(text!=lastSpokenText||!available.Contains(lastPackVoice)){
   lastPackVoice=VoiceRotation.Choose(available,lastPackVoice,S.AudioVoice);lastSpokenText=text;
  }
  return lastPackVoice==""?"":VoiceRotation.AudioPath(root,lastPackVoice,text);
 }
 void AddVoicePicker(System.Windows.Controls.Panel panel){
  Add(panel,"شخصيات الصوت",23,Ink,true);
  Add(panel,"يتغيّر الصوت مع الجملة الجديدة. إعادة الجملة أو إبطاؤها تحافظ على نفس المتحدث. الأصوات المتاحة تختلف حسب المقاطع المثبتة.",15,Muted);
  var choices=new[]{new VoiceChoice("random","عشوائي · متحدث مختلف لكل جملة")}.Concat(VoiceRotation.Voices.Select(v=>new VoiceChoice(v.Id,v.Label))).ToList();
  var picker=new System.Windows.Controls.ComboBox{ItemsSource=choices,SelectedItem=choices.FirstOrDefault(v=>v.Id==S.AudioVoice)??choices[0],MinHeight=44,Margin=new(0,10,0,10)};
  picker.SelectionChanged+=(_,_)=>{S.AudioVoice=((VoiceChoice)picker.SelectedItem).Id;lastSpokenText="";lastPackVoice="";useCloud=false;Save();};panel.Children.Add(picker);
  var root=Path.Combine(AppContext.BaseDirectory,"Assets","Audio");
  foreach(var voice in VoiceRotation.Voices){var dir=voice.Id=="eric"?root:Path.Combine(root,voice.Id);int count=Directory.Exists(dir)?Directory.GetFiles(dir,"*.mp3").Length:0;Add(panel,$"{voice.Label}: {count} مقطع مثبت",14,Muted);}
  Add(panel,"الصوت السردي صوت مستقل؛ ليس تسجيلًا أو استنساخًا لصوت ديكستر مورغان.",13,Muted);
 }
}
