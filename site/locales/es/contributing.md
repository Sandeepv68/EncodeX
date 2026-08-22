# Ayuda a mejorar EncodeX

EncodeX es gratuito y lo construyen voluntarios — y no necesitas saber programar para ayudar. Estas son algunas formas en que cualquiera puede participar:

- **Cuéntanos cuando algo falle.** Si la app se cierra o un archivo no se convierte, [abre un issue](https://github.com/Sandeepv68/EncodeX/issues) y describe qué pasó. Los reportes de usuarios comunes son oro.
- **Sugiere ideas.** ¿Quieres que EncodeX haga algo que aún no hace? Dínoslo — muchas funciones nacen de sugerencias de usuarios.
- **Traduce.** EncodeX habla más de 35 idiomas, y los traductores siempre son bienvenidos. Si falta tu idioma o suena raro, puedes ayudar a arreglarlo.
- **Corre la voz.** Comparte EncodeX con amigos, escribe una reseña o crea un tutorial.

## Ponte en contacto

¿Preguntas, ideas o solo quieres saludar? Escribe directamente al desarrollador en **[developer@encodex.in](mailto:developer@encodex.in)** — los comentarios de los usuarios siempre son bienvenidos.

## Para desarrolladores

Si quieres contribuir código, así puedes empezar:

### Desarrollo

```bash
npm run dev          # modo desarrollo con recarga en caliente
npm run electron:dev # entorno completo de desarrollo con ventana Electron
npm run build        # compilación completa
npm start            # ejecutar la app compilada
```

### Convenciones del proyecto

- **TypeScript** — modo estricto, sin `any` cuando sea posible.
- **React** — componentes funcionales con hooks.
- **Estado** — stores de Zustand para el estado global.
- **IPC** — todos los canales definidos en `src/shared/ipc-channels.ts`.
- **Constantes** — valores fijos en los archivos de constantes de `src/shared/`.
- **i18n** — todos los textos visibles al usuario en `src/renderer/i18n/locales/`.

### Proceso de Pull Request

1. Asegúrate de que la compilación pase: `npm run build`
2. Actualiza los archivos de idioma si añades o modificas textos de la interfaz.
3. Mantén cada PR enfocado en un solo cambio.

## Código de conducta

Este proyecto sigue el [Contributor Covenant](https://github.com/Sandeepv68/EncodeX/blob/main/CODE_OF_CONDUCT.md). Sé amable y respetuoso — todos estamos aquí porque nos gusta el proyecto.
