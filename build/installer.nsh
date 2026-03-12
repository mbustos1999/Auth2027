; Oculta la carpeta resources y el desinstalador para que solo se vea el .exe principal.
; Usuarios sin conocimientos no verán archivos ni carpetas (hay que activar "Mostrar archivos ocultos" y "Archivos protegidos del sistema" para verlos).
!macro customInstall
  SetFileAttributes "$INSTDIR\resources" HIDDEN
  SetFileAttributes "$INSTDIR\resources" SYSTEM
  FindFirst $0 $1 "$INSTDIR\Uninstall*"
  hideUninstallLoop:
    StrCmp $1 "" hideUninstallDone
    SetFileAttributes "$INSTDIR\$1" HIDDEN
    SetFileAttributes "$INSTDIR\$1" SYSTEM
    FindNext $0 $1
    Goto hideUninstallLoop
  hideUninstallDone:
  FindClose $0
!macroend
