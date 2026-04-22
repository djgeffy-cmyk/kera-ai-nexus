INSERT INTO public.ipm_endpoints (label, base_url, kind, auth_type, token, notes, enabled)
VALUES (
  'IPM SOAP - WPTProcessoDigital (Guaramirim)',
  'https://guaramirim.atende.net/?pg=services&service=WPTProcessoDigital&wsdl',
  'authenticated',
  'none',
  NULL,
  E'Serviço SOAP/WSDL do IPM atende.net para Consulta de Processo Digital.\nProvedor: IPM\nServiço: WPTProcessoDigital\nCódigo: 18518\nResponsável: GEVERSON CARLOS DALPRA\nCNPJ: 18.298.772/0001-17\nProtocolo: SOAP (WSDL)\nObs: endpoint exige envelope SOAP. A Kera pode usar como referência ou via scraping enquanto não há cliente SOAP nativo.',
  true
)
ON CONFLICT DO NOTHING;