; Setup program for the Windows route, built from the pinned upstream source archive.
;
; This installs a source drop, not a prebuilt unlock: the EFI image has to be compiled
; against the target machine's own partitions, so shipping a binary would be useless. That
; is also why this runs per-user and asks for no elevation — copying files cannot brick a
; boot configuration, and nothing here touches the ESP or the BCD store.

Unicode true

!include "MUI2.nsh"

!ifndef VERSION
  !define VERSION "0.3.1"
!endif
!ifndef STAGE
  !error "STAGE is required: the staged source tree to package"
!endif
!ifndef OUTFILE
  !define OUTFILE "GPU-Unlock-Windows-${VERSION}-Setup.exe"
!endif

!define APPNAME "GPU Unlock for Windows"
!define PUBLISHER "GPU Unlock"
!define UPSTREAM "https://github.com/impacifist/Windows-GPU-UNLOCK"

Name "${APPNAME} ${VERSION}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\GPU Unlock for Windows"
InstallDirRegKey HKCU "Software\GPUUnlockWindows" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUnInstDetails show
BrandingText "${APPNAME} ${VERSION}"

VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1033 "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=1033 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1033 "FileDescription" "${APPNAME} setup"
VIAddVersionKey /LANG=1033 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1033 "LegalCopyright" "GPL-2.0-only; NVIDIA firmware is not included"
VIAddVersionKey /LANG=1033 "Comments" "${UPSTREAM}"

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_FINISHPAGE_SHOWREADME "$INSTDIR\START-HERE.txt"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Open START-HERE.txt"
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "licence.txt"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Source tree (required)" SecSource
  SectionIn RO
  SetOutPath "$INSTDIR"
  SetOverwrite on
  File /r "${STAGE}\*.*"

  ; Written rather than shipped so the version and the pinned commit in the copy the user
  ; receives always match the setup program they ran.
  FileOpen $0 "$INSTDIR\START-HERE.txt" w
  FileWrite $0 "${APPNAME} ${VERSION}$\r$\n"
  FileWrite $0 "Upstream source: ${UPSTREAM}$\r$\n"
  FileWrite $0 "$\r$\n"
  FileWrite $0 "1. README.md explains what this does and what it cannot do.$\r$\n"
  FileWrite $0 "2. docs/GUIDE.en.md is the USB route; docs/HEADLESS.en.md is the internal-boot route.$\r$\n"
  FileWrite $0 "3. The five firmware assets are NOT included. Generate them as docs/ASSETS.en.md says;$\r$\n"
  FileWrite $0 "   packaging fails its hash check without them.$\r$\n"
  FileWrite $0 "4. The EFI image must be built on the target machine against its own partitions.$\r$\n"
  FileWrite $0 "   There is no prebuilt EFI here and none is supplied by this installer.$\r$\n"
  FileClose $0

  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\START-HERE.lnk" "$INSTDIR\START-HERE.txt"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Uninstall.lnk" "$INSTDIR\uninstall.exe"

  WriteRegStr HKCU "Software\GPUUnlockWindows" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\GPUUnlockWindows" "Version" "${VERSION}"
  WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd

Section "Documentation shortcuts" SecDocs
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\USB guide.lnk" "$INSTDIR\docs\GUIDE.en.md"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Internal headless guide.lnk" "$INSTDIR\docs\HEADLESS.en.md"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Compatibility.lnk" "$INSTDIR\docs\COMPATIBILITY.en.md"
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecSource} "Scripts, documentation, licences and the source the EFI is built from. No firmware and no prebuilt EFI."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecDocs} "Start-menu shortcuts to the guides installed above."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "Uninstall"
  Delete "$SMPROGRAMS\${APPNAME}\START-HERE.lnk"
  Delete "$SMPROGRAMS\${APPNAME}\USB guide.lnk"
  Delete "$SMPROGRAMS\${APPNAME}\Internal headless guide.lnk"
  Delete "$SMPROGRAMS\${APPNAME}\Compatibility.lnk"
  Delete "$SMPROGRAMS\${APPNAME}\Uninstall.lnk"
  RMDir "$SMPROGRAMS\${APPNAME}"
  DeleteRegKey HKCU "Software\GPUUnlockWindows"
  ; Local state and backups are recovery inputs; leave them if the user has any.
  MessageBox MB_YESNO|MB_DEFBUTTON2 "Remove installed files from$\r$\n$INSTDIR?$\r$\n$\r$\nKeep them if you built an EFI there — local state and backups are what you restore from." IDNO +2
  RMDir /r "$INSTDIR"
SectionEnd
