import { PRODUCT_NAME } from '@writehand/contracts';
import type { AiText } from '@writehand/ui';

export const aiEs: AiText = {
  title: 'Conexión de IA',
  description:
    'Escribe correos con tu plan de ChatGPT, tu propia clave de API de OpenAI o Claude Code en este equipo.',
  chatgpt: 'Plan de ChatGPT',
  apiKey: 'Clave de API de OpenAI',
  claudeCode: 'Plan de Claude',
  methodHints: {
    chatgpt: 'Con tu plan Plus o Pro',
    'api-key': 'Pago por uso',
    'claude-code': 'Con Claude Code en este equipo',
  },
  methodLabel: 'Método de conexión',
  recommended: 'Recomendado',
  experimental: 'Experimental',
  statusReady: 'Listo',
  statusSetup: 'Falta la instalación',
  statusAction: 'Falta la conexión',
  guide: {
    title: 'Guía de conexión',
    intro:
      'Configura uno de los métodos siguientes para generar texto. Cada sección indica lo que necesitas y los pasos que debes seguir.',
    requirementsLabel: 'Necesitas',
    stepsLabel: 'Pasos',
    notesLabel: 'Conviene saber',
    current: 'Seleccionado',
    methods: {
      chatgpt: {
        title: 'Plan de ChatGPT',
        summary: 'Genera texto con el uso incluido en tu plan ChatGPT Plus o Pro.',
        requirements: [
          'Una suscripción ChatGPT Plus o Pro. Las cuentas gratuitas no permiten usar el plan.',
          `La aplicación auxiliar de ${PRODUCT_NAME} en este equipo.`,
        ],
        steps: [
          'Elige “Plan de ChatGPT” como método.',
          'Elige “Continue with ChatGPT”. En la página que se abre, elige tu cuenta y permite el acceso.',
          'Vuelve a esta página; la cuenta muestra “Conectado · Listo para generar texto”. Después elige un modelo.',
        ],
        notes: [
          'El uso se descuenta de los límites de tu plan de ChatGPT. Puedes seguirlo en ChatGPT → Configuración → Usage.',
          'Si acabas de mejorar tu plan, puede tardar unos minutos en activarse.',
          'Por ahora OpenAI solo admite los planes Plus y Pro. En cuentas de trabajo (Business, Enterprise), una directiva de la organización puede bloquear la conexión.',
          'Puedes quitar el acceso cuando quieras en ChatGPT → Configuración → Security and login → Sign in with ChatGPT.',
        ],
      },
      'api-key': {
        title: 'Clave de API de OpenAI',
        summary: 'Genera texto con tu propia cuenta de OpenAI Platform; pagas lo que usas.',
        requirements: [
          'Una cuenta de OpenAI Platform y una clave de API.',
          `La aplicación auxiliar de ${PRODUCT_NAME} en este equipo.`,
        ],
        steps: [
          'Crea una clave de API en OpenAI Platform.',
          'Elige “Clave de API de OpenAI” como método, pega la clave y elige “Conectar clave”.',
          'Elige un modelo de la lista.',
        ],
        notes: [
          'El uso de la API es independiente de una suscripción de ChatGPT y lo factura OpenAI.',
          'La clave se guarda solo en la aplicación auxiliar de este equipo y nunca se devuelve al navegador.',
        ],
        linkLabel: 'Crear una clave de API',
      },
      'claude-code': {
        title: 'Plan de Claude',
        summary: 'Usa Claude Code en tu equipo con tu propia cuenta de Claude.',
        requirements: [
          'Una suscripción Claude Pro, Max, Team o Enterprise.',
          'Claude Code instalado en este equipo y con la sesión iniciada en tu cuenta de Claude.',
          `La aplicación auxiliar de ${PRODUCT_NAME}. Si la instalas después de Claude Code, lo encuentra automáticamente.`,
        ],
        steps: [
          'Instala Claude Code siguiendo las instrucciones oficiales de Anthropic.',
          'En un terminal, ejecuta `claude` e inicia sesión en tu cuenta de Claude con `/login`.',
          'Instala la aplicación auxiliar; si ya la tenías instalada, vuelve a instalarla después de Claude Code.',
          'Elige “Plan de Claude” como método. Aquí aparecerán tu cuenta y tu plan.',
        ],
        notes: [
          `${PRODUCT_NAME} nunca ve ni guarda tu contraseña ni tu sesión de Claude; inicias y cierras sesión a través de Claude Code.`,
          'El uso se descuenta del límite de tu plan, que compartes con Claude Code.',
          'En los planes Pro y Max, el contenido puede usarse para entrenar modelos, salvo que lo hayas desactivado en tu configuración de privacidad de Claude. Los planes Team y Enterprise se rigen por las condiciones comerciales.',
          'Si Claude Code tiene la sesión iniciada con una clave de API, el uso se factura a esa cuenta de API.',
          'Este método depende de las normas de Anthropic para aplicaciones de terceros y se ofrece como experimental. Puede dejar de funcionar si esas normas cambian.',
        ],
        linkLabel: 'Guía de instalación de Claude Code',
      },
    },
    helper: {
      title: '¿Qué es la aplicación auxiliar?',
      summary: 'Una pequeña aplicación en tu equipo que necesitan todos los métodos.',
      requirements: ['macOS, Linux o Windows. No necesitas ningún otro programa.'],
      steps: [
        'Abre el asistente de configuración desde Configuración → Aplicación auxiliar y ejecuta el comando de una línea que muestra.',
        'En unos segundos la aplicación auxiliar aparece como conectada; después elige un método aquí.',
      ],
      notes: [
        'Los datos de inicio de sesión y las claves de API se guardan en un archivo protegido al que solo tú puedes acceder, no en el navegador.',
        'La aplicación auxiliar solo se ejecuta cuando pides texto; nunca lee ni envía correos en segundo plano.',
      ],
    },
  },
  connect: 'Continue with ChatGPT',
  addAccount: 'Añadir otra cuenta o espacio de trabajo',
  reconnect: 'Volver a conectar',
  disconnect: 'Desconectar',
  account: 'Cuenta de ChatGPT',
  activeAccount: 'Cuenta en uso',
  useAccount: 'Usar esta cuenta',
  savedConnection: 'Cuenta conectada. Elige “Usar esta cuenta” para generar con ella.',
  renameAccount: 'Cambiar nombre',
  accountName: 'Nombre de la conexión',
  accountNameHint:
    'Por ejemplo, “Personal” o “Trabajo · Nombre de la empresa”. El nombre solo se guarda en este dispositivo; hasta 80 caracteres.',
  saveAccountName: 'Guardar nombre',
  removeAccount: 'Quitar cuenta',
  removeAccountTitle: '¿Quitar esta conexión?',
  removeAccountBody:
    'Se quitarán de este dispositivo el registro de la cuenta y sus credenciales; si existe una sesión de OpenAI, se intentará revocarla. Se cancelará cualquier inicio de sesión pendiente. Vuelve a añadir la cuenta para usarla más adelante. Tu cuenta de ChatGPT no se eliminará.',
  confirmRemoveAccount: 'Quitar',
  savedAccountHint:
    'Selecciona una conexión guardada para cambiarle el nombre o quitarla. Los botones de inicio de sesión usan la cuenta y el espacio de trabajo de la conexión seleccionada. Para conectar otra cuenta, usa el botón de añadir de abajo.',
  model: 'Modelo',
  refresh: 'Actualizar',
  checking: 'Comprobando la conexión…',
  signingIn: 'Completa el inicio de sesión de ChatGPT en la ventana del navegador.',
  cancel: 'Cancelar',
  connected: 'Conectado · Listo para generar texto',
  disconnected: 'Sesión cerrada',
  registrationIncomplete:
    'La conexión de la cuenta está incompleta; sus datos aún no se han comprobado. Vuelve a probar “Continue with ChatGPT” con la misma cuenta y el mismo espacio de trabajo que en el primer intento.',
  generationUnavailable:
    'Cuenta comprobada y permiso del plan concedido; la generación de texto aún no está lista. Elige “Actualizar” para volver a cargar la lista de modelos.',
  planDisabled:
    'Cuenta comprobada; la generación no está autorizada. Usar el plan requiere una cuenta Plus o Pro apta y permiso para usar su plan. Iniciar sesión con una cuenta gratuita no da acceso a la generación.',
  planNote:
    'Las cuentas Plus y Pro aptas pueden usar la asignación de su plan. La disponibilidad depende de tu cuenta, tu espacio de trabajo y tu acceso a OpenAI.',
  apiNote:
    'OpenAI factura el uso de la API por separado. Es independiente de tu suscripción de ChatGPT; este método nunca se elige automáticamente.',
  claudeNote: `Claude Code, instalado en este equipo, se ejecuta con tu propia cuenta de Claude; el uso se descuenta de los límites de tu plan de Claude. ${PRODUCT_NAME} no accede a tus credenciales de Claude ni las guarda. Inicias y cierras sesión a través de Claude Code.`,
  claudeAccount: 'Cuenta de Claude Code',
  claudeNotInstalled:
    'No se encontró Claude Code en este equipo. Instala Claude Code, vuelve a ejecutar el comando de instalación de la aplicación auxiliar y después elige “Actualizar”.',
  claudeNotLoggedIn:
    'Claude Code no tiene la sesión iniciada. Ejecuta claude en un terminal, inicia sesión con /login y después elige “Actualizar”.',
  claudeApiBilling:
    'Claude Code tiene la sesión iniciada con un método distinto de una suscripción de Claude, como una clave de API; el uso se factura a esa cuenta.',
  claudePrivacy:
    'Cuando pides una generación, tu texto, tus indicaciones y el contexto seleccionado se envían a Anthropic a través de Claude Code. Claude Code se ejecuta sin herramientas, no puede acceder a tus archivos y no guarda transcripciones de sesión. Los planes Pro y Max se rigen por las condiciones para consumidores de Anthropic: salvo que hayas desactivado el entrenamiento de modelos en tu configuración de privacidad de Claude, el contenido puede usarse para entrenar. Los planes Team y Enterprise se rigen por las condiciones comerciales.',
  apiKeyLabel: 'Clave de API',
  saveKey: 'Conectar clave',
  removeKey: 'Quitar clave',
  keySaved: 'Clave de API guardada en la aplicación auxiliar.',
  manageUsage: 'Administrar uso',
  connectionHelp:
    'Administra esta conexión en la configuración de ChatGPT, en Security and login → Sign in with ChatGPT. No aparece en Plugins. Las cuentas de trabajo también dependen de la directiva de la organización y de la idoneidad del plan.',
  welcome: 'Estás usando tu plan de ChatGPT',
  welcomeBody: `La generación apta en ${PRODUCT_NAME} usa la asignación de tu plan de ChatGPT o los créditos disponibles. Administra el uso de esta aplicación en la configuración de ChatGPT.`,
  gotIt: 'Entendido',
  privacy:
    'Cuando pides una generación, tu texto, tus indicaciones y el contexto seleccionado se envían a OpenAI. La extensión no los guarda en el disco. No tiene acceso a tu historial de conversaciones de ChatGPT.',
  usePlan: 'Usando el plan de ChatGPT',
  useApi: 'Usando la API de OpenAI',
  useClaude: 'Usando el plan de Claude',
  openSettings: 'Configuración de IA',
  notReady: 'Conecta una cuenta de IA para generar texto',
};
