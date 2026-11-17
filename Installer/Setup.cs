using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Diagnostics;
using System.Drawing;
using System.Threading.Tasks;
using System.Windows.Forms;

static class Setup {
 static string InstallPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "TradeEnglish");
 static string Quote(string s) { return "\"" + s + "\""; }
 [STAThread] static int Main(string[] args) {
  if(args.Length==2 && args[0]=="--extract-test") {
   try { Extract(Path.GetFullPath(args[1]), null); return 0; }
   catch(Exception e) { Console.Error.WriteLine(e.Message); return 1; }
  }
  Application.EnableVisualStyles();
  var form=new Form { Text="Trade English — التثبيت", Size=new Size(620,340), StartPosition=FormStartPosition.CenterScreen, FormBorderStyle=FormBorderStyle.FixedDialog, MaximizeBox=false, Font=new Font("Segoe UI",11), RightToLeft=RightToLeft.Yes };
  var title=new Label { Text="تثبيت رحلة التاجر — Trade English", AutoSize=false, Bounds=new Rectangle(25,20,550,40), Font=new Font("Segoe UI",17,FontStyle.Bold) };
  var info=new Label { Text="48 درسًا • 1,997 مقطعًا صوتيًا\nتعمل دون إنترنت. متطلبات التشغيل مضمّنة.\nتقدّمك السابق يبقى محفوظًا.", Bounds=new Rectangle(25,70,550,85) };
  var progress=new ProgressBar { Bounds=new Rectangle(25,170,550,25) };
  var status=new Label { Text="التثبيت لحسابك دون صلاحيات مسؤول", Bounds=new Rectangle(25,205,550,30) };
  var button=new Button { Text="تثبيت البرنامج", Bounds=new Rectangle(355,245,220,40) };
  bool busy=false,done=false;
  button.Click+=async delegate {
   if(done) { Process.Start(new ProcessStartInfo(Path.Combine(InstallPath,"runtime","dotnet.exe"),Quote(Path.Combine(InstallPath,"app","TradeEnglish.dll"))) { WorkingDirectory=Path.Combine(InstallPath,"app"), UseShellExecute=true }); form.Close(); return; }
   busy=true;button.Enabled=false;status.Text="جارٍ تثبيت البرنامج والصوتيات…";
   try {
    await Task.Run(()=>Extract(InstallPath, n=>form.BeginInvoke((Action)(()=>progress.Value=n))));
    Shortcut(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
    Shortcut(Environment.GetFolderPath(Environment.SpecialFolder.Programs));
    done=true;status.Text="اكتمل التثبيت — أُضيف اختصار على سطح المكتب";button.Text="فتح البرنامج";
   } catch(Exception e) { MessageBox.Show("تعذّر التثبيت. أغلق البرنامج إن كان مفتوحًا ثم أعد المحاولة.\n"+e.Message,"Trade English"); status.Text="لم يكتمل التثبيت"; }
   busy=false;button.Enabled=true;
  };
  form.FormClosing+=(s,e)=> { if(busy)e.Cancel=true; };
  form.Controls.AddRange(new Control[]{title,info,progress,status,button});Application.Run(form);return 0;
 }
 static void Extract(string target, Action<int> report) {
  string prefix=Path.GetFullPath(target).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
  using(var data=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip")) {
   if(data==null)throw new Exception("Missing installer payload");
   using(var zip=new ZipArchive(data,ZipArchiveMode.Read)) {
    int index=0;
    foreach(var entry in zip.Entries) {
     string dest=Path.GetFullPath(Path.Combine(prefix,entry.FullName));
     if(!dest.StartsWith(prefix,StringComparison.OrdinalIgnoreCase))throw new Exception("Invalid archive path");
     Directory.CreateDirectory(Path.GetDirectoryName(dest));
     if(entry.Name.Length>0)using(var input=entry.Open())using(var output=File.Create(dest))input.CopyTo(output);
     if(report!=null && (++index%30==0 || index==zip.Entries.Count))report(index*100/zip.Entries.Count);
    }
   }
  }
 }
 static void Shortcut(string directory) {
  Directory.CreateDirectory(directory);
  dynamic shell=Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
  dynamic link=shell.CreateShortcut(Path.Combine(directory,"Trade English.lnk"));
  link.TargetPath=Path.Combine(InstallPath,"runtime","dotnet.exe");
  link.Arguments=Quote(Path.Combine(InstallPath,"app","TradeEnglish.dll"));
  link.WorkingDirectory=Path.Combine(InstallPath,"app");
  link.IconLocation=Path.Combine(InstallPath,"app","TradeEnglish.exe")+",0";
  link.Description="Trade English — رحلة التاجر";link.Save();
 }
}
