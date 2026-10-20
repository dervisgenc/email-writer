import { PRODUCT_NAME } from '@writehand/contracts';

import type { WelcomeText } from './extension-text';

export const welcomeEs: WelcomeText = {
  title: `Te damos la bienvenida a ${PRODUCT_NAME}`,
  subtitle: 'Listo en cuatro pasos cortos',
  stepsLabel: 'Pasos de configuración',
  steps: ['Bienvenida', 'Aplicación', 'Conexión', 'Pruébalo'],
  back: 'Atrás',
  next: 'Continuar',
  intro: {
    title: '¿Por qué una aplicación auxiliar?',
    lead: `${PRODUCT_NAME} funciona dentro de Outlook en la Web. Una pequeña aplicación auxiliar en tu equipo hace lo que una extensión del navegador no puede hacer por sí sola.`,
    reasons: [
      'Iniciar sesión con ChatGPT requiere una dirección de retorno en tu equipo, que una extensión no puede proporcionar.',
      'Tus datos de inicio de sesión y claves de API quedan protegidos en tu equipo, no en el navegador.',
      'Es de código abierto: puedes leer cada línea de su código.',
    ],
    source: 'Código fuente en GitHub',
    doesTitle: 'Qué hace',
    does: [
      'Envía el texto que eliges al proveedor que eliges, solo cuando lo pides.',
      'Mantiene tu conexión con ChatGPT, OpenAI o Claude.',
    ],
    doesNotTitle: 'Qué no hace nunca',
    doesNot: [
      'Enviar correos.',
      'Leer tu buzón en segundo plano.',
      'Enviar nada a un servidor nuestro: no existe.',
    ],
  },
  install: {
    title: 'Instala la aplicación auxiliar',
    lead: 'Un solo comando la instala para tu cuenta de usuario. No necesitas permisos de administrador.',
    system: 'Tu sistema',
    command: 'Comando de instalación',
    terminal: {
      darwin: 'Abre Terminal (Aplicaciones → Utilidades), pega el comando y pulsa Retorno.',
      linux: 'Abre una terminal (a menudo Ctrl+Alt+T), pega el comando y pulsa Intro.',
      windows: 'Abre PowerShell (clic derecho en Inicio y elige Terminal), pega el comando y pulsa Intro.',
    },
    waiting:
      'Esperando a la aplicación auxiliar… Aparecerá aquí unos segundos después de que termine el comando.',
    connected: (version) => `Aplicación auxiliar conectada (versión ${version}).`,
    whatTitle: '¿Qué hace el comando?',
    what: [
      'Descarga el programa para tu sistema desde la última versión publicada en GitHub.',
      'Comprueba su suma SHA-256 y se detiene si no coincide.',
      'Lo instala en tu carpeta de usuario, sin permisos de administrador.',
      'Lo registra en Firefox, Chrome, Edge y Brave para que esta extensión pueda comunicarse con él.',
    ],
  },
  tryIt: {
    title: 'Pruébalo',
    lead: 'Corrige un correo inventado para comprobar que todo funciona. El texto solo va al proveedor que elegiste; no se envía ningún correo.',
    sampleLabel: 'Correo de ejemplo',
    sample:
      'Hola Sam:\n\ngracias por tu mensage. Puedo enviar el informe el jueves, pero antes nesecito las últimas cifras de tu equipo. ¿Podrías compartirlas asta el miércoles?\n\nSaludos,\nAlex',
    run: 'Corregir el ejemplo',
    running: 'Corrigiendo…',
    success: 'Todo funciona. Abre un borrador en Outlook; la barra de herramientas aparece junto a él.',
    resultLabel: 'Resultado',
    openOutlook: 'Abrir Outlook',
    personalOutlook: 'Outlook.com (personal)',
    openSettings: 'Configuración',
  },
};
