// Rodapé global desativado: estava cobrindo o composer do chat e poluindo
// as demais telas. Mantemos o componente como no-op para preservar imports
// existentes (ex.: <Footer /> em App.tsx) sem precisar removê-los.
const Footer = () => null;

export default Footer;
