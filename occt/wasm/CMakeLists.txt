cmake_minimum_required(VERSION 3.16)
project(OcctImportJS CXX)

set(CMAKE_CXX_STANDARD 17)
find_package(OpenCASCADE REQUIRED CONFIG)

file(GLOB sources CONFIGURE_DEPENDS *.cpp)
add_executable(occt-import-js ${sources})
target_include_directories(occt-import-js PRIVATE ${OpenCASCADE_INCLUDE_DIR})
target_link_libraries(occt-import-js PRIVATE TKDESTEP TKDEIGES TKXCAF TKMesh)
target_compile_options(occt-import-js PRIVATE -fwasm-exceptions -UOCC_CONVERT_SIGNALS)
target_link_options(occt-import-js PRIVATE
  -fwasm-exceptions
  --bind
  -sMODULARIZE=1
  -sEXPORT_NAME=occtimportjs
  -sSTACK_SIZE=10MB
  -sALLOW_MEMORY_GROWTH=1
  -sMAXIMUM_MEMORY=4GB
  -sDYNAMIC_EXECUTION=0
  -sEXPORT_ES6=1
  -sENVIRONMENT=web,worker)
