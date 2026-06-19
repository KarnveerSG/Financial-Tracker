!macro preInit
  ReadEnvStr $0 APPDATA
  StrCpy $INSTDIR "$0\MidnightLedger\Runtime"
!macroend
