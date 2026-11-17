using System.IO;
using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace TradeEnglish;
public record Phrase(string En,string Ar);
public record Lesson(int Id,int Unit,string Title,string Goal,List<Phrase> Phrases);
public record Unit(int Id,string Title,string Tag,string Goal);
public static class Course {
 public static readonly List<Unit> Units=new(); public static readonly List<Lesson> Lessons=new();
 static Course(){using var s=Assembly.GetExecutingAssembly().GetManifestResourceStream("TradeEnglish.course.txt")!;using var r=new StreamReader(s);Lesson? current=null;while(r.ReadLine() is string line){if(string.IsNullOrWhiteSpace(line))continue;var parts=line[2..].Split('|');if(line.StartsWith("# "))Units.Add(new(int.Parse(parts[0]),parts[1],parts[2],parts[3]));else if(line.StartsWith("@ ")){current=new(Lessons.Count,int.Parse(parts[0]),parts[1],parts[2],new());Lessons.Add(current);}else{var p=line.Split('|');current!.Phrases.Add(new(p[0],p[1]));}}}
 public static string Normal(string s)=>Regex.Replace(s.ToLowerInvariant().Replace('’','\''),@"[^\p{L}\p{N}\s]","").Split((char[]?)null,StringSplitOptions.RemoveEmptyEntries).Aggregate("",(a,b)=>a.Length==0?b:a+" "+b);
 public static Phrase Phrase(string key){var a=key.Split(':');return Lessons[int.Parse(a[0])].Phrases[int.Parse(a[1])];}
}
public class ReviewItem {public int Box{get;set;} public DateTime Due{get;set;}=DateTime.Today;}
public class State {
 public string AudioVoice{get;set;}="random";public int Version{get;set;}=2;public HashSet<int> Done{get;set;}=new();public HashSet<int> CasesDone{get;set;}=new();public int Xp{get;set;}
 public Dictionary<string,int> Days{get;set;}=new();public Dictionary<string,ReviewItem> Review{get;set;}=new();public HashSet<string> Favorites{get;set;}=new();
 public int Streak(){var d=DateTime.Today;if(Days.GetValueOrDefault(d.ToString("yyyy-MM-dd"))<60)d=d.AddDays(-1);int n=0;while(Days.GetValueOrDefault(d.ToString("yyyy-MM-dd"))>=60){n++;d=d.AddDays(-1);}return n;}
 public bool Unlocked(int id)=>id==0||Done.Contains(id-1)||Done.Contains(id);
 public void Mark(string key,bool correct){if(!Review.TryGetValue(key,out var r))Review[key]=r=new();r.Box=correct?Math.Min(5,r.Box+1):0;r.Due=DateTime.Today.AddDays(correct?new[]{0,1,3,7,14,30}[r.Box]:0);}
 public int Complete(int id){var reward=Done.Add(id)?60:10;Xp+=reward;return reward;}
}
public class Store {
 public string PathName{get;}=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"TradeEnglish","progress-v2.json");
 public State Data{get;private set;}=new();public string? Error{get;private set;}
 public Store(bool load=true){if(!load)return;try{if(File.Exists(PathName))Data=JsonSerializer.Deserialize<State>(File.ReadAllText(PathName))??new();}catch{Error="تعذر قراءة تقدمك السابق. احتُفظ بالملف وسنحاول الحفظ في ملف استرداد.";PathName=Path.Combine(Path.GetDirectoryName(PathName)!,"recovery-"+DateTime.Now.ToString("yyyyMMddHHmmss")+".json");}}
 public bool Save(){try{Directory.CreateDirectory(Path.GetDirectoryName(PathName)!);var temp=PathName+".tmp";File.WriteAllText(temp,JsonSerializer.Serialize(Data));File.Move(temp,PathName,true);return true;}catch{Error="تعذر حفظ التقدم على الجهاز. تحقق من مساحة القرص وصلاحيات المجلد.";return false;}}
}
