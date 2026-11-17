using System.IO;
using System.Text.Json;
namespace TradeEnglish;
static class Tests {
 public static int Run(){var results=new List<string>();void Check(bool ok,string title){if(!ok)throw new Exception(title);results.Add("PASS "+title);}
 try{
 var app=new System.Windows.Application();
 var family=new System.Windows.Media.FontFamily(new Uri("pack://application:,,,/"),"./Fonts/#thmanyah serif text");
 foreach(var weight in new[]{System.Windows.FontWeights.Light,System.Windows.FontWeights.Normal,System.Windows.FontWeights.Medium,System.Windows.FontWeights.Bold,System.Windows.FontWeights.Black}){
 var face=new System.Windows.Media.Typeface(family,System.Windows.FontStyles.Normal,weight,System.Windows.FontStretches.Normal);
 Check(face.TryGetGlyphTypeface(out var glyph)&&glyph.CharacterToGlyphMap.ContainsKey(0x0627)&&glyph.FontUri.ToString().Contains("thmanyah"),"Embedded Thmanyah weight "+weight);
 }
 var wav=MainWindow.GenerateLocalAudio("Could you send me your catalogue?",false,Path.Combine(AppContext.BaseDirectory,"audio-test"));
 var bytes=File.ReadAllBytes(wav);Check(bytes.Length>2000&&System.Text.Encoding.ASCII.GetString(bytes,8,4)=="WAVE"&&bytes.Skip(1024).Any(b=>b!=0),"Local English synthesis produces nonempty WAV");
 var slowWav=MainWindow.GenerateLocalAudio("Could you send me your catalogue?",true,Path.Combine(AppContext.BaseDirectory,"audio-test"));Check(new FileInfo(slowWav).Length>bytes.Length,"Slow speech produces longer audio");
 Check(Course.Units.Count==8&&Course.Lessons.Count==48,"8 units and 48 lessons");
 var requiredAudio=Course.Lessons.SelectMany(l=>l.Phrases.Select(p=>p.En)).Concat(MainWindow.Cases.SelectMany(c=>c.Select(s=>s.Supplier))).Distinct().ToList();
 Check(requiredAudio.Count==312,"Audio manifest covers lessons and supplier dialogue");
 if(Directory.Exists(Path.Combine(AppContext.BaseDirectory,"Assets","Audio"))){
 Check(requiredAudio.Count(t=>new FileInfo(Path.Combine(AppContext.BaseDirectory,"Assets","Audio",MainWindow.PackagedAudioName(t))) is var file&&file.Exists&&file.Length>1000)>=234,"Original 234 offline clips remain available; new clips use Windows until generated");
 var player=new System.Windows.Media.MediaPlayer{Volume=0};var frame=new System.Windows.Threading.DispatcherFrame();bool opened=false;var limit=new System.Windows.Threading.DispatcherTimer{Interval=TimeSpan.FromSeconds(12)};
 player.MediaOpened+=(_,_)=>{opened=player.NaturalDuration.HasTimeSpan&&player.NaturalDuration.TimeSpan.TotalSeconds>0;frame.Continue=false;};player.MediaFailed+=(_,_)=>frame.Continue=false;limit.Tick+=(_,_)=>frame.Continue=false;limit.Start();player.Open(new Uri(Path.Combine(AppContext.BaseDirectory,"Assets","Audio",MainWindow.PackagedAudioName(requiredAudio[0]))));System.Windows.Threading.Dispatcher.PushFrame(frame);limit.Stop();player.Close();Check(opened,"Windows playback engine opens bundled MP3");
 }
 Check(Course.Lessons.All(l=>l.Phrases.Count==6),"288 bilingual phrases");
 Check(Course.Lessons.SelectMany(l=>l.Phrases).All(p=>p.Ar.Any(c=>c>='\u0600'&&c<='\u06ff')&&!p.Ar.Contains('\ufffd')&&p.En.All(c=>c<128)),"Arabic Unicode and English integrity");
 Check(Course.Lessons.SelectMany(l=>l.Phrases).Select(p=>p.En).Distinct().Count()==288,"All sentences unique");
 Check(Course.Normal("  Hello, MY name is Laith! ")==Course.Normal("Hello my name is Laith."),"Punctuation and whitespace tolerant answers");
 Check(Course.Normal("We need fifteen boxes")!=Course.Normal("We need fifty boxes"),"Different quantities are not accepted");
 Check(MainWindow.Cases.Length==Course.Units.Count&&MainWindow.Cases.All(c=>c.Length==3),"Every unit has a three-turn scenario");
 Check(Course.Lessons.Select((l,i)=>l.Id==i).All(x=>x),"Stable sequential lesson IDs");
 Check(Course.Lessons[0].Phrases[0].En=="Hello, my name is Laith."&&Course.Lessons[36].Unit==6,"Old progress keys preserved, expansion appended");
 Check(VoiceRotation.Choose(Array.Empty<string>(),"eric","random")=="","Missing pack falls back safely");
 Check(VoiceRotation.Choose(new[]{"eric"},"eric","random")=="eric","Single available voice fallback");
 Check(Enumerable.Range(0,100).All(_=>VoiceRotation.Choose(new[]{"eric","brian","george"},"brian","random")!="brian"),"Random voice avoids immediate repeats");
 Check(VoiceRotation.Choose(new[]{"eric","brian"},"brian","brian")=="brian","Fixed voice selection respected");
 Check(JsonSerializer.Deserialize<State>("{}")!.AudioVoice=="random","Old saves default to random voice");
 var s=new State();Check(s.Unlocked(0)&&!s.Unlocked(1),"Sequential unlock");Check(s.Complete(0)==60&&s.Unlocked(1)&&!s.Unlocked(2),"Completion opens next lesson");Check(s.Complete(0)==10&&s.Done.Count==1,"Replay rewards without duplicate completion");
 s.Mark("0:0",false);Check(s.Review["0:0"].Due==DateTime.Today,"Errors due immediately");s.Mark("0:0",true);Check(s.Review["0:0"].Due==DateTime.Today.AddDays(1),"First successful review one day");s.Mark("0:0",true);Check(s.Review["0:0"].Due==DateTime.Today.AddDays(3),"Second review three days");s.Mark("0:0",false);Check(s.Review["0:0"].Box==0,"Errors reset review interval");
 s.Days[DateTime.Today.ToString("yyyy-MM-dd")]=70;s.Days[DateTime.Today.AddDays(-1).ToString("yyyy-MM-dd")]=60;Check(s.Streak()==2,"Daily streak");
 s.Days[DateTime.Today.ToString("yyyy-MM-dd")]=20;Check(s.Streak()==1,"Brief session preserves yesterday streak");
 var copy=JsonSerializer.Deserialize<State>(JsonSerializer.Serialize(s))!;Check(copy.Done.Contains(0)&&copy.Review.ContainsKey("0:0")&&copy.Xp==70,"Progress round trip");
 foreach(var l in Course.Lessons)for(int i=0;i<6;i++)Check(Course.Phrase($"{l.Id}:{i}")==l.Phrases[i],$"Phrase key {l.Id}:{i}");
 File.WriteAllText(Path.Combine(AppContext.BaseDirectory,"test-results.txt"),string.Join("\n",results)+$"\n{results.Count} checks passed");return 0;
 }catch(Exception ex){File.WriteAllText(Path.Combine(AppContext.BaseDirectory,"test-results.txt"),string.Join("\n",results)+"\nFAIL "+ex);return 1;}
 }
}
