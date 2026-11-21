#include <BRepBndLib.hxx>
#include <BRepMesh_IncrementalMesh.hxx>
#include <BRepTools.hxx>
#include <BRep_Builder.hxx>
#include <Bnd_Box.hxx>
#include <IGESCAFControl_Reader.hxx>
#include <Message_ProgressRange.hxx>
#include <RWGltf_CafWriter.hxx>
#include <STEPCAFControl_Reader.hxx>
#include <TColStd_IndexedDataMapOfStringString.hxx>
#include <TDF_LabelSequence.hxx>
#include <TDocStd_Document.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Shape.hxx>
#include <XCAFApp_Application.hxx>
#include <XCAFDoc_DocumentTool.hxx>
#include <XCAFDoc_ShapeTool.hxx>

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>

static void say(const char* message) {
  std::printf("%s\n", message);
  std::fflush(stdout);
}

static std::string extensionOf(const std::string& path) {
  const size_t dot = path.find_last_of('.');
  std::string ext = dot == std::string::npos ? "" : path.substr(dot + 1);
  std::transform(ext.begin(), ext.end(), ext.begin(), [](unsigned char c) { return std::tolower(c); });
  return ext;
}

static bool read(const std::string& path, Handle(TDocStd_Document) doc) {
  const std::string ext = extensionOf(path);
  if (ext == "step" || ext == "stp") {
    STEPCAFControl_Reader reader;
    reader.SetColorMode(true);
    reader.SetNameMode(true);
    reader.SetLayerMode(false);
    return reader.ReadFile(path.c_str()) == IFSelect_RetDone && reader.Transfer(doc);
  }
  if (ext == "iges" || ext == "igs") {
    IGESCAFControl_Reader reader;
    reader.SetColorMode(true);
    reader.SetNameMode(true);
    return reader.ReadFile(path.c_str()) == IFSelect_RetDone && reader.Transfer(doc);
  }
  if (ext == "brep" || ext == "brp") {
    TopoDS_Shape shape;
    BRep_Builder builder;
    if (!BRepTools::Read(shape, path.c_str(), builder) || shape.IsNull()) return false;
    XCAFDoc_DocumentTool::ShapeTool(doc->Main())->AddShape(shape);
    return true;
  }
  return false;
}

static int mesh(const Handle(TDocStd_Document)& doc) {
  TDF_LabelSequence roots;
  XCAFDoc_DocumentTool::ShapeTool(doc->Main())->GetFreeShapes(roots);
  Bnd_Box box;
  for (Standard_Integer i = 1; i <= roots.Length(); i++) BRepBndLib::Add(XCAFDoc_ShapeTool::GetShape(roots.Value(i)), box);
  if (box.IsVoid()) return 0;
  const double size = std::sqrt(box.SquareExtent());
  const double deflection = std::clamp(size * 0.0005, 0.01, 2.0);

  int solids = 0;
  for (Standard_Integer i = 1; i <= roots.Length(); i++) {
    const TopoDS_Shape shape = XCAFDoc_ShapeTool::GetShape(roots.Value(i));
    for (TopExp_Explorer it(shape, TopAbs_SOLID); it.More(); it.Next()) {
      BRepMesh_IncrementalMesh(it.Current(), deflection, false, 0.5, false);
      if (++solids % 100 == 0) std::printf("Meshed %d solids\n", solids), std::fflush(stdout);
    }
    for (TopExp_Explorer it(shape, TopAbs_FACE, TopAbs_SOLID); it.More(); it.Next())
      BRepMesh_IncrementalMesh(it.Current(), deflection, false, 0.5, false);
  }
  return solids;
}

int main(int argc, char** argv) {
  if (argc != 3) {
    std::fprintf(stderr, "usage: step2glb <model.step|.iges|.brep> <out.glb>\n");
    return 2;
  }
  Handle(XCAFApp_Application) app = XCAFApp_Application::GetApplication();
  Handle(TDocStd_Document) doc;
  app->NewDocument("BinXCAF", doc);

  say("Reading the model");
  if (!read(argv[1], doc)) {
    std::fprintf(stderr, "OpenCascade could not read this file.\n");
    return 3;
  }

  say("Meshing solids");
  mesh(doc);
  XCAFDoc_DocumentTool::SetLengthUnit(doc, 1.0);

  say("Writing the model");
  RWGltf_CafWriter writer(argv[2], true);
  writer.SetTransformationFormat(RWGltf_WriterTrsfFormat_Compact);
  writer.SetMergeFaces(true);
  writer.ChangeCoordinateSystemConverter().SetInputCoordinateSystem(RWMesh_CoordinateSystem_Zup);
  TColStd_IndexedDataMapOfStringString metadata;
  if (!writer.Perform(doc, metadata, Message_ProgressRange())) {
    std::fprintf(stderr, "The converted model could not be written.\n");
    return 4;
  }
  say("Done");
  return 0;
}
