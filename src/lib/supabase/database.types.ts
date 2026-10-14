export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      abonos_empleados: {
        Row: {
          created_at: string;
          created_by: string | null;
          empleado_id: number;
          entregado_por: string | null;
          fecha: string;
          id: number;
          monto: number;
          nota: string | null;
          periodo_id: number | null;
          tipo: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          empleado_id: number;
          entregado_por?: string | null;
          fecha?: string;
          id?: never;
          monto: number;
          nota?: string | null;
          periodo_id?: number | null;
          tipo?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          empleado_id?: number;
          entregado_por?: string | null;
          fecha?: string;
          id?: never;
          monto?: number;
          nota?: string | null;
          periodo_id?: number | null;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "abonos_empleados_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "abonos_empleados_empleado_id_fkey";
            columns: ["empleado_id"];
            isOneToOne: false;
            referencedRelation: "empleados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "abonos_empleados_empleado_id_fkey";
            columns: ["empleado_id"];
            isOneToOne: false;
            referencedRelation: "v_resumen_empleados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "abonos_empleados_periodo_id_fkey";
            columns: ["periodo_id"];
            isOneToOne: false;
            referencedRelation: "periodos_nomina";
            referencedColumns: ["id"];
          },
        ];
      };
      abonos_proveedor: {
        Row: {
          created_at: string;
          created_by: string | null;
          fecha: string;
          id: number;
          metodo_id: number | null;
          moneda: string;
          monto: number;
          nota: string | null;
          numero: number;
          pagado_por: string | null;
          proveedor_id: number;
          referencia: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          fecha?: string;
          id?: never;
          metodo_id?: number | null;
          moneda: string;
          monto: number;
          nota?: string | null;
          numero?: number;
          pagado_por?: string | null;
          proveedor_id: number;
          referencia?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          fecha?: string;
          id?: never;
          metodo_id?: number | null;
          moneda?: string;
          monto?: number;
          nota?: string | null;
          numero?: number;
          pagado_por?: string | null;
          proveedor_id?: number;
          referencia?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "abonos_proveedor_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "abonos_proveedor_metodo_id_fkey";
            columns: ["metodo_id"];
            isOneToOne: false;
            referencedRelation: "metodos_pago";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "abonos_proveedor_moneda_fkey";
            columns: ["moneda"];
            isOneToOne: false;
            referencedRelation: "monedas";
            referencedColumns: ["codigo"];
          },
          {
            foreignKeyName: "abonos_proveedor_proveedor_id_fkey";
            columns: ["proveedor_id"];
            isOneToOne: false;
            referencedRelation: "proveedores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "abonos_proveedor_proveedor_id_fkey";
            columns: ["proveedor_id"];
            isOneToOne: false;
            referencedRelation: "v_resumen_proveedores";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          accion: string;
          antes: Json | null;
          despues: Json | null;
          id: number;
          nota: string | null;
          ocurrido_el: string;
          registro_id: string | null;
          tabla: string;
          usuario: string | null;
          usuario_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          accion: string;
          antes?: Json | null;
          despues?: Json | null;
          id?: never;
          nota?: string | null;
          ocurrido_el?: string;
          registro_id?: string | null;
          tabla: string;
          usuario?: string | null;
          usuario_id?: string | null;
        };
        Update: {
          accion?: string;
          antes?: Json | null;
          despues?: Json | null;
          id?: never;
          nota?: string | null;
          ocurrido_el?: string;
          registro_id?: string | null;
          tabla?: string;
          usuario?: string | null;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cestas_proveedor: {
        Row: {
          created_at: string;
          created_by: string | null;
          devueltas: number;
          entrega_id: number | null;
          entregadas: number;
          fecha: string;
          id: number;
          nota: string | null;
          proveedor_id: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          devueltas?: number;
          entrega_id?: number | null;
          entregadas?: number;
          fecha?: string;
          id?: never;
          nota?: string | null;
          proveedor_id: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          devueltas?: number;
          entrega_id?: number | null;
          entregadas?: number;
          fecha?: string;
          id?: never;
          nota?: string | null;
          proveedor_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "cestas_proveedor_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cestas_proveedor_entrega_id_fkey";
            columns: ["entrega_id"];
            isOneToOne: false;
            referencedRelation: "entregas_proveedor";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cestas_proveedor_proveedor_id_fkey";
            columns: ["proveedor_id"];
            isOneToOne: false;
            referencedRelation: "proveedores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cestas_proveedor_proveedor_id_fkey";
            columns: ["proveedor_id"];
            isOneToOne: false;
            referencedRelation: "v_resumen_proveedores";
            referencedColumns: ["id"];
          },
        ];
      };
      clientes: {
        Row: {
          activo: boolean;
          correo: string | null;
          created_at: string;
          created_by: string | null;
          direccion: string | null;
          documento: string | null;
          id: number;
          limite_credito: number | null;
          limite_moneda: string | null;
          nombre: string;
          notas: string | null;
          numero: number | null;
          search: string | null;
          telefono: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          correo?: string | null;
          created_at?: string;
          created_by?: string | null;
          direccion?: string | null;
          documento?: string | null;
          id?: never;
          limite_credito?: number | null;
          limite_moneda?: string | null;
          nombre: string;
          notas?: string | null;
          numero?: number | null;
          search?: never;
          telefono?: string | null;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          correo?: string | null;
          created_at?: string;
          created_by?: string | null;
          direccion?: string | null;
          documento?: string | null;
          id?: never;
          limite_credito?: number | null;
          limite_moneda?: string | null;
          nombre?: string;
          notas?: string | null;
          numero?: number | null;
          search?: never;
          telefono?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clientes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clientes_limite_moneda_fkey";
            columns: ["limite_moneda"];
            isOneToOne: false;
            referencedRelation: "monedas";
            referencedColumns: ["codigo"];
          },
        ];
      };
      contadores: {
        Row: {
          clave: string;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          clave: string;
          valor?: number;
        };
        Update: {
          clave?: string;
          valor?: number;
        };
        Relationships: [];
      };
      empaques_clientes: {
        Row: {
          cliente_id: number;
          created_at: string;
          created_by: string | null;
          devueltas: number;
          factura_id: number | null;
          fecha: string;
          id: number;
          nota: string | null;
          retiradas: number;
        };
        ComputedFields: never;
        Insert: {
          cliente_id: number;
          created_at?: string;
          created_by?: string | null;
          devueltas?: number;
          factura_id?: number | null;
          fecha?: string;
          id?: never;
          nota?: string | null;
          retiradas?: number;
        };
        Update: {
          cliente_id?: number;
          created_at?: string;
          created_by?: string | null;
          devueltas?: number;
          factura_id?: number | null;
          fecha?: string;
          id?: never;
          nota?: string | null;
          retiradas?: number;
        };
        Relationships: [
          {
            foreignKeyName: "empaques_clientes_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "empaques_clientes_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "v_resumen_clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "empaques_clientes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "empaques_clientes_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: false;
            referencedRelation: "facturas";
            referencedColumns: ["id"];
          },
        ];
      };
      empleados: {
        Row: {
          activo: boolean;
          cargo: string | null;
          cedula: string | null;
          codigo: string | null;
          created_at: string;
          fecha_ingreso: string | null;
          fecha_registro: string;
          id: number;
          nombre: string;
          notas: string | null;
          search: string | null;
          tarifa_dia: number;
          telefono: string | null;
          tipo: Database["public"]["Enums"]["tipo_empleado"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          cargo?: string | null;
          cedula?: string | null;
          codigo?: string | null;
          created_at?: string;
          fecha_ingreso?: string | null;
          fecha_registro?: string;
          id?: never;
          nombre: string;
          notas?: string | null;
          search?: never;
          tarifa_dia?: number;
          telefono?: string | null;
          tipo?: Database["public"]["Enums"]["tipo_empleado"];
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          cargo?: string | null;
          cedula?: string | null;
          codigo?: string | null;
          created_at?: string;
          fecha_ingreso?: string | null;
          fecha_registro?: string;
          id?: never;
          nombre?: string;
          notas?: string | null;
          search?: never;
          tarifa_dia?: number;
          telefono?: string | null;
          tipo?: Database["public"]["Enums"]["tipo_empleado"];
          updated_at?: string;
        };
        Relationships: [];
      };
      empresa: {
        Row: {
          cambio_moneda_con_pagos: string;
          correo: string;
          direccion: string;
          factura_numero_inicial: number;
          factura_prefijo: string;
          id: number;
          iva_pct: number;
          logo_path: string | null;
          lotes_activos: boolean;
          moneda_defecto: string;
          nomina_inicio_semana: number;
          nomina_periodicidad: string;
          pie_factura: string;
          razon_social: string;
          rif: string;
          roles_editan_factura: Database["public"]["Enums"]["rol_usuario"][];
          stock_insuficiente: string;
          telefonos: string;
          texto_legal: string;
          titulo_documento: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cambio_moneda_con_pagos?: string;
          correo?: string;
          direccion?: string;
          factura_numero_inicial?: number;
          factura_prefijo?: string;
          id?: number;
          iva_pct?: number;
          logo_path?: string | null;
          lotes_activos?: boolean;
          moneda_defecto?: string;
          nomina_inicio_semana?: number;
          nomina_periodicidad?: string;
          pie_factura?: string;
          razon_social?: string;
          rif?: string;
          roles_editan_factura?: Database["public"]["Enums"]["rol_usuario"][];
          stock_insuficiente?: string;
          telefonos?: string;
          texto_legal?: string;
          titulo_documento?: string;
          updated_at?: string;
        };
        Update: {
          cambio_moneda_con_pagos?: string;
          correo?: string;
          direccion?: string;
          factura_numero_inicial?: number;
          factura_prefijo?: string;
          id?: number;
          iva_pct?: number;
          logo_path?: string | null;
          lotes_activos?: boolean;
          moneda_defecto?: string;
          nomina_inicio_semana?: number;
          nomina_periodicidad?: string;
          pie_factura?: string;
          razon_social?: string;
          rif?: string;
          roles_editan_factura?: Database["public"]["Enums"]["rol_usuario"][];
          stock_insuficiente?: string;
          telefonos?: string;
          texto_legal?: string;
          titulo_documento?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "empresa_moneda_fk";
            columns: ["moneda_defecto"];
            isOneToOne: false;
            referencedRelation: "monedas";
            referencedColumns: ["codigo"];
          },
        ];
      };
      entregas_proveedor: {
        Row: {
          cestas: number;
          created_at: string;
          created_by: string | null;
          desc_merma: number;
          fecha: string;
          foto_path: string | null;
          foto_url: string | null;
          id: number;
          kg_por_cesta: number | null;
          kg_total: number;
          merma: number;
          modo_pesaje: string;
          moneda: string;
          nota: string | null;
          peso_neto: number;
          precio: number;
          precio_kg: number;
          producto_id: number;
          proveedor_id: number;
          total: number;
          unidades: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cestas?: number;
          created_at?: string;
          created_by?: string | null;
          desc_merma?: number;
          fecha?: string;
          foto_path?: string | null;
          foto_url?: string | null;
          id?: never;
          kg_por_cesta?: number | null;
          kg_total?: number;
          merma?: number;
          modo_pesaje: string;
          moneda: string;
          nota?: string | null;
          peso_neto?: number;
          precio: number;
          precio_kg?: number;
          producto_id: number;
          proveedor_id: number;
          total?: number;
          unidades?: number;
          updated_at?: string;
        };
        Update: {
          cestas?: number;
          created_at?: string;
          created_by?: string | null;
          desc_merma?: number;
          fecha?: string;
          foto_path?: string | null;
          foto_url?: string | null;
          id?: never;
          kg_por_cesta?: number | null;
          kg_total?: number;
          merma?: number;
          modo_pesaje?: string;
          moneda?: string;
          nota?: string | null;
          peso_neto?: number;
          precio?: number;
          precio_kg?: number;
          producto_id?: number;
          proveedor_id?: number;
          total?: number;
          unidades?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entregas_proveedor_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entregas_proveedor_moneda_fkey";
            columns: ["moneda"];
            isOneToOne: false;
            referencedRelation: "monedas";
            referencedColumns: ["codigo"];
          },
          {
            foreignKeyName: "entregas_proveedor_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entregas_proveedor_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "v_stock";
            referencedColumns: ["producto_id"];
          },
          {
            foreignKeyName: "entregas_proveedor_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "v_stock_total";
            referencedColumns: ["producto_id"];
          },
          {
            foreignKeyName: "entregas_proveedor_proveedor_id_fkey";
            columns: ["proveedor_id"];
            isOneToOne: false;
            referencedRelation: "proveedores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entregas_proveedor_proveedor_id_fkey";
            columns: ["proveedor_id"];
            isOneToOne: false;
            referencedRelation: "v_resumen_proveedores";
            referencedColumns: ["id"];
          },
        ];
      };
      existencias: {
        Row: {
          actualizado: string;
          cantidad: number;
          forma: Database["public"]["Enums"]["forma_inventario"];
          lote_id: number | null;
          producto_id: number;
          ubicacion_id: number;
        };
        ComputedFields: never;
        Insert: {
          actualizado?: string;
          cantidad?: number;
          forma: Database["public"]["Enums"]["forma_inventario"];
          lote_id?: number | null;
          producto_id: number;
          ubicacion_id: number;
        };
        Update: {
          actualizado?: string;
          cantidad?: number;
          forma?: Database["public"]["Enums"]["forma_inventario"];
          lote_id?: number | null;
          producto_id?: number;
          ubicacion_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "existencias_lote_id_fkey";
            columns: ["lote_id"];
            isOneToOne: false;
            referencedRelation: "lotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "existencias_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "existencias_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "v_stock";
            referencedColumns: ["producto_id"];
          },
          {
            foreignKeyName: "existencias_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "v_stock_total";
            referencedColumns: ["producto_id"];
          },
          {
            foreignKeyName: "existencias_ubicacion_id_fkey";
            columns: ["ubicacion_id"];
            isOneToOne: false;
            referencedRelation: "ubicaciones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "existencias_ubicacion_id_fkey";
            columns: ["ubicacion_id"];
            isOneToOne: false;
            referencedRelation: "v_stock";
            referencedColumns: ["ubicacion_id"];
          },
        ];
      };
      factura_lineas: {
        Row: {
          aplica_iva: boolean;
          cantidad: number;
          codigo: number;
          descripcion: string;
          factura_id: number;
          id: number;
          orden: number;
          precio_unitario: number;
          producto_id: number;
          total_linea: number;
          unidad: string;
        };
        ComputedFields: never;
        Insert: {
          aplica_iva?: boolean;
          cantidad: number;
          codigo: number;
          descripcion: string;
          factura_id: number;
          id?: never;
          orden?: number;
          precio_unitario: number;
          producto_id: number;
          total_linea?: number;
          unidad: string;
        };
        Update: {
          aplica_iva?: boolean;
          cantidad?: number;
          codigo?: number;
          descripcion?: string;
          factura_id?: number;
          id?: never;
          orden?: number;
          precio_unitario?: number;
          producto_id?: number;
          total_linea?: number;
          unidad?: string;
        };
        Relationships: [
          {
            foreignKeyName: "factura_lineas_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: false;
            referencedRelation: "facturas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "factura_lineas_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "factura_lineas_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "v_stock";
            referencedColumns: ["producto_id"];
          },
          {
            foreignKeyName: "factura_lineas_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "v_stock_total";
            referencedColumns: ["producto_id"];
          },
        ];
      };
      factura_versiones: {
        Row: {
          accion: string;
          cambios: Json | null;
          created_at: string;
          created_by: string | null;
          factura_id: number;
          id: number;
          motivo: string | null;
          snapshot: NonNullable<Json>;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          accion: string;
          cambios?: Json | null;
          created_at?: string;
          created_by?: string | null;
          factura_id: number;
          id?: never;
          motivo?: string | null;
          snapshot: NonNullable<Json>;
          version: number;
        };
        Update: {
          accion?: string;
          cambios?: Json | null;
          created_at?: string;
          created_by?: string | null;
          factura_id?: number;
          id?: never;
          motivo?: string | null;
          snapshot?: NonNullable<Json>;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "factura_versiones_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "factura_versiones_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: false;
            referencedRelation: "facturas";
            referencedColumns: ["id"];
          },
        ];
      };
      facturas: {
        Row: {
          anulada_el: string | null;
          anulada_por: string | null;
          base_imponible: number;
          cliente_direccion: string | null;
          cliente_documento: string | null;
          cliente_id: number;
          cliente_nombre: string | null;
          cliente_numero: number | null;
          cliente_telefono: string | null;
          condicion: Database["public"]["Enums"]["condicion_pago"];
          created_at: string;
          created_by: string | null;
          emitida_el: string | null;
          emitida_por: string | null;
          estado: Database["public"]["Enums"]["estado_factura"];
          estado_pago: string | null;
          exento: number;
          fecha: string;
          id: number;
          iva: number;
          iva_pct: number;
          moneda: string;
          motivo_anulacion: string | null;
          numero: number | null;
          numero_externo: string | null;
          observaciones: string | null;
          origen: Database["public"]["Enums"]["origen_factura"];
          pagado: number;
          saldo: number | null;
          soporte_path: string | null;
          soporte_url: string | null;
          subtotal: number;
          total: number;
          ubicacion_id: number | null;
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          anulada_el?: string | null;
          anulada_por?: string | null;
          base_imponible?: number;
          cliente_direccion?: string | null;
          cliente_documento?: string | null;
          cliente_id: number;
          cliente_nombre?: string | null;
          cliente_numero?: number | null;
          cliente_telefono?: string | null;
          condicion?: Database["public"]["Enums"]["condicion_pago"];
          created_at?: string;
          created_by?: string | null;
          emitida_el?: string | null;
          emitida_por?: string | null;
          estado?: Database["public"]["Enums"]["estado_factura"];
          estado_pago?: never;
          exento?: number;
          fecha?: string;
          id?: never;
          iva?: number;
          iva_pct?: number;
          moneda: string;
          motivo_anulacion?: string | null;
          numero?: number | null;
          numero_externo?: string | null;
          observaciones?: string | null;
          origen?: Database["public"]["Enums"]["origen_factura"];
          pagado?: number;
          saldo?: never;
          soporte_path?: string | null;
          soporte_url?: string | null;
          subtotal?: number;
          total?: number;
          ubicacion_id?: number | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          anulada_el?: string | null;
          anulada_por?: string | null;
          base_imponible?: number;
          cliente_direccion?: string | null;
          cliente_documento?: string | null;
          cliente_id?: number;
          cliente_nombre?: string | null;
          cliente_numero?: number | null;
          cliente_telefono?: string | null;
          condicion?: Database["public"]["Enums"]["condicion_pago"];
          created_at?: string;
          created_by?: string | null;
          emitida_el?: string | null;
          emitida_por?: string | null;
          estado?: Database["public"]["Enums"]["estado_factura"];
          estado_pago?: never;
          exento?: number;
          fecha?: string;
          id?: never;
          iva?: number;
          iva_pct?: number;
          moneda?: string;
          motivo_anulacion?: string | null;
          numero?: number | null;
          numero_externo?: string | null;
          observaciones?: string | null;
          origen?: Database["public"]["Enums"]["origen_factura"];
          pagado?: number;
          saldo?: never;
          soporte_path?: string | null;
          soporte_url?: string | null;
          subtotal?: number;
          total?: number;
          ubicacion_id?: number | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "facturas_anulada_por_fkey";
            columns: ["anulada_por"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "facturas_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "facturas_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "v_resumen_clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "facturas_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "facturas_emitida_por_fkey";
            columns: ["emitida_por"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "facturas_moneda_fkey";
            columns: ["moneda"];
            isOneToOne: false;
            referencedRelation: "monedas";
            referencedColumns: ["codigo"];
          },
          {
            foreignKeyName: "facturas_ubicacion_id_fkey";
            columns: ["ubicacion_id"];
            isOneToOne: false;
            referencedRelation: "ubicaciones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "facturas_ubicacion_id_fkey";
            columns: ["ubicacion_id"];
            isOneToOne: false;
            referencedRelation: "v_stock";
            referencedColumns: ["ubicacion_id"];
          },
        ];
      };
      jornada_tareas: {
        Row: {
          cantidad: number;
          id: number;
          jornada_id: number;
          subtotal: number | null;
          tarea_id: number;
          valor_unitario: number;
        };
        ComputedFields: never;
        Insert: {
          cantidad: number;
          id?: never;
          jornada_id: number;
          subtotal?: never;
          tarea_id: number;
          valor_unitario: number;
        };
        Update: {
          cantidad?: number;
          id?: never;
          jornada_id?: number;
          subtotal?: never;
          tarea_id?: number;
          valor_unitario?: number;
        };
        Relationships: [
          {
            foreignKeyName: "jornada_tareas_jornada_id_fkey";
            columns: ["jornada_id"];
            isOneToOne: false;
            referencedRelation: "jornadas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jornada_tareas_tarea_id_fkey";
            columns: ["tarea_id"];
            isOneToOne: false;
            referencedRelation: "tareas_nomina";
            referencedColumns: ["id"];
          },
        ];
      };
      jornadas: {
        Row: {
          created_at: string;
          created_by: string | null;
          empleado_id: number;
          estado: Database["public"]["Enums"]["estado_jornada"];
          fecha: string;
          ganado: number | null;
          id: number;
          justificada: boolean;
          nota: string | null;
          pago_adicional: number;
          pago_dia: number;
          tarifa_aplicada: number;
          total_tareas: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          empleado_id: number;
          estado: Database["public"]["Enums"]["estado_jornada"];
          fecha: string;
          ganado?: never;
          id?: never;
          justificada?: boolean;
          nota?: string | null;
          pago_adicional?: number;
          pago_dia?: number;
          tarifa_aplicada?: number;
          total_tareas?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          empleado_id?: number;
          estado?: Database["public"]["Enums"]["estado_jornada"];
          fecha?: string;
          ganado?: never;
          id?: never;
          justificada?: boolean;
          nota?: string | null;
          pago_adicional?: number;
          pago_dia?: number;
          tarifa_aplicada?: number;
          total_tareas?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jornadas_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jornadas_empleado_id_fkey";
            columns: ["empleado_id"];
            isOneToOne: false;
            referencedRelation: "empleados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jornadas_empleado_id_fkey";
            columns: ["empleado_id"];
            isOneToOne: false;
            referencedRelation: "v_resumen_empleados";
            referencedColumns: ["id"];
          },
        ];
      };
      lotes: {
        Row: {
          codigo: string;
          created_at: string;
          fecha_produccion: string;
          id: number;
          nota: string | null;
          producto_id: number;
          vence_el: string | null;
        };
        ComputedFields: never;
        Insert: {
          codigo: string;
          created_at?: string;
          fecha_produccion?: string;
          id?: never;
          nota?: string | null;
          producto_id: number;
          vence_el?: string | null;
        };
        Update: {
          codigo?: string;
          created_at?: string;
          fecha_produccion?: string;
          id?: never;
          nota?: string | null;
          producto_id?: number;
          vence_el?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lotes_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lotes_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "v_stock";
            referencedColumns: ["producto_id"];
          },
          {
            foreignKeyName: "lotes_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "v_stock_total";
            referencedColumns: ["producto_id"];
          },
        ];
      };
      metodos_pago: {
        Row: {
          activo: boolean;
          id: number;
          nombre: string;
          orden: number;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          id?: never;
          nombre: string;
          orden?: number;
        };
        Update: {
          activo?: boolean;
          id?: never;
          nombre?: string;
          orden?: number;
        };
        Relationships: [];
      };
      monedas: {
        Row: {
          activa: boolean;
          codigo: string;
          decimales: number;
          nombre: string;
          orden: number;
          simbolo: string;
        };
        ComputedFields: never;
        Insert: {
          activa?: boolean;
          codigo: string;
          decimales?: number;
          nombre: string;
          orden?: number;
          simbolo?: string;
        };
        Update: {
          activa?: boolean;
          codigo?: string;
          decimales?: number;
          nombre?: string;
          orden?: number;
          simbolo?: string;
        };
        Relationships: [];
      };
      movimientos_inventario: {
        Row: {
          cantidad: number;
          created_at: string;
          created_by: string | null;
          entrega_id: number | null;
          factura_id: number | null;
          fecha: string;
          forma: Database["public"]["Enums"]["forma_inventario"];
          id: number;
          lote_id: number | null;
          nota: string | null;
          produccion_id: number | null;
          producto_id: number;
          tipo: Database["public"]["Enums"]["tipo_movimiento"];
          traslado_id: string | null;
          ubicacion_id: number;
        };
        ComputedFields: never;
        Insert: {
          cantidad: number;
          created_at?: string;
          created_by?: string | null;
          entrega_id?: number | null;
          factura_id?: number | null;
          fecha?: string;
          forma?: Database["public"]["Enums"]["forma_inventario"];
          id?: never;
          lote_id?: number | null;
          nota?: string | null;
          produccion_id?: number | null;
          producto_id: number;
          tipo: Database["public"]["Enums"]["tipo_movimiento"];
          traslado_id?: string | null;
          ubicacion_id: number;
        };
        Update: {
          cantidad?: number;
          created_at?: string;
          created_by?: string | null;
          entrega_id?: number | null;
          factura_id?: number | null;
          fecha?: string;
          forma?: Database["public"]["Enums"]["forma_inventario"];
          id?: never;
          lote_id?: number | null;
          nota?: string | null;
          produccion_id?: number | null;
          producto_id?: number;
          tipo?: Database["public"]["Enums"]["tipo_movimiento"];
          traslado_id?: string | null;
          ubicacion_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "movimientos_inventario_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_inventario_entrega_id_fkey";
            columns: ["entrega_id"];
            isOneToOne: false;
            referencedRelation: "entregas_proveedor";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_inventario_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: false;
            referencedRelation: "facturas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_inventario_lote_id_fkey";
            columns: ["lote_id"];
            isOneToOne: false;
            referencedRelation: "lotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_inventario_produccion_id_fkey";
            columns: ["produccion_id"];
            isOneToOne: false;
            referencedRelation: "producciones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_inventario_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_inventario_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "v_stock";
            referencedColumns: ["producto_id"];
          },
          {
            foreignKeyName: "movimientos_inventario_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "v_stock_total";
            referencedColumns: ["producto_id"];
          },
          {
            foreignKeyName: "movimientos_inventario_ubicacion_id_fkey";
            columns: ["ubicacion_id"];
            isOneToOne: false;
            referencedRelation: "ubicaciones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_inventario_ubicacion_id_fkey";
            columns: ["ubicacion_id"];
            isOneToOne: false;
            referencedRelation: "v_stock";
            referencedColumns: ["ubicacion_id"];
          },
        ];
      };
      pago_aplicaciones: {
        Row: {
          created_at: string;
          factura_id: number;
          id: number;
          monto: number;
          pago_id: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          factura_id: number;
          id?: never;
          monto: number;
          pago_id: number;
        };
        Update: {
          created_at?: string;
          factura_id?: number;
          id?: never;
          monto?: number;
          pago_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pago_aplicaciones_factura_id_fkey";
            columns: ["factura_id"];
            isOneToOne: false;
            referencedRelation: "facturas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pago_aplicaciones_pago_id_fkey";
            columns: ["pago_id"];
            isOneToOne: false;
            referencedRelation: "pagos_clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      pagos_clientes: {
        Row: {
          cliente_id: number;
          created_at: string;
          created_by: string | null;
          fecha: string;
          id: number;
          metodo_id: number | null;
          moneda: string;
          monto: number;
          nota: string | null;
          numero: number;
          pago_origen_id: number | null;
          referencia: string | null;
          tasa_conversion: number | null;
          tipo: Database["public"]["Enums"]["tipo_pago_cliente"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cliente_id: number;
          created_at?: string;
          created_by?: string | null;
          fecha?: string;
          id?: never;
          metodo_id?: number | null;
          moneda: string;
          monto: number;
          nota?: string | null;
          numero?: number;
          pago_origen_id?: number | null;
          referencia?: string | null;
          tasa_conversion?: number | null;
          tipo?: Database["public"]["Enums"]["tipo_pago_cliente"];
          updated_at?: string;
        };
        Update: {
          cliente_id?: number;
          created_at?: string;
          created_by?: string | null;
          fecha?: string;
          id?: never;
          metodo_id?: number | null;
          moneda?: string;
          monto?: number;
          nota?: string | null;
          numero?: number;
          pago_origen_id?: number | null;
          referencia?: string | null;
          tasa_conversion?: number | null;
          tipo?: Database["public"]["Enums"]["tipo_pago_cliente"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pagos_clientes_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagos_clientes_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "v_resumen_clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagos_clientes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagos_clientes_metodo_id_fkey";
            columns: ["metodo_id"];
            isOneToOne: false;
            referencedRelation: "metodos_pago";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagos_clientes_moneda_fkey";
            columns: ["moneda"];
            isOneToOne: false;
            referencedRelation: "monedas";
            referencedColumns: ["codigo"];
          },
          {
            foreignKeyName: "pagos_clientes_pago_origen_id_fkey";
            columns: ["pago_origen_id"];
            isOneToOne: false;
            referencedRelation: "pagos_clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      periodo_nomina_items: {
        Row: {
          abonos: number;
          detalle: Json | null;
          dias_asistidos: number;
          empleado_id: number;
          faltas: number;
          ganado: number;
          medias: number;
          neto: number;
          periodo_id: number;
          saldo_anterior: number;
          total_dias: number;
          total_tareas: number;
        };
        ComputedFields: never;
        Insert: {
          abonos?: number;
          detalle?: Json | null;
          dias_asistidos?: number;
          empleado_id: number;
          faltas?: number;
          ganado?: number;
          medias?: number;
          neto?: number;
          periodo_id: number;
          saldo_anterior?: number;
          total_dias?: number;
          total_tareas?: number;
        };
        Update: {
          abonos?: number;
          detalle?: Json | null;
          dias_asistidos?: number;
          empleado_id?: number;
          faltas?: number;
          ganado?: number;
          medias?: number;
          neto?: number;
          periodo_id?: number;
          saldo_anterior?: number;
          total_dias?: number;
          total_tareas?: number;
        };
        Relationships: [
          {
            foreignKeyName: "periodo_nomina_items_empleado_id_fkey";
            columns: ["empleado_id"];
            isOneToOne: false;
            referencedRelation: "empleados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "periodo_nomina_items_empleado_id_fkey";
            columns: ["empleado_id"];
            isOneToOne: false;
            referencedRelation: "v_resumen_empleados";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "periodo_nomina_items_periodo_id_fkey";
            columns: ["periodo_id"];
            isOneToOne: false;
            referencedRelation: "periodos_nomina";
            referencedColumns: ["id"];
          },
        ];
      };
      periodos_nomina: {
        Row: {
          cerrado_el: string | null;
          cerrado_por: string | null;
          created_at: string;
          desde: string;
          estado: string;
          hasta: string;
          id: number;
          nota: string | null;
        };
        ComputedFields: never;
        Insert: {
          cerrado_el?: string | null;
          cerrado_por?: string | null;
          created_at?: string;
          desde: string;
          estado?: string;
          hasta: string;
          id?: never;
          nota?: string | null;
        };
        Update: {
          cerrado_el?: string | null;
          cerrado_por?: string | null;
          created_at?: string;
          desde?: string;
          estado?: string;
          hasta?: string;
          id?: never;
          nota?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "periodos_nomina_cerrado_por_fkey";
            columns: ["cerrado_por"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      producciones: {
        Row: {
          created_at: string;
          created_by: string | null;
          fecha: string;
          id: number;
          nota: string | null;
          responsable: string | null;
          ubicacion_id: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          fecha?: string;
          id?: never;
          nota?: string | null;
          responsable?: string | null;
          ubicacion_id: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          fecha?: string;
          id?: never;
          nota?: string | null;
          responsable?: string | null;
          ubicacion_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "producciones_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producciones_ubicacion_id_fkey";
            columns: ["ubicacion_id"];
            isOneToOne: false;
            referencedRelation: "ubicaciones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "producciones_ubicacion_id_fkey";
            columns: ["ubicacion_id"];
            isOneToOne: false;
            referencedRelation: "v_stock";
            referencedColumns: ["ubicacion_id"];
          },
        ];
      };
      productos: {
        Row: {
          activo: boolean;
          categoria: string;
          codigo: number;
          created_at: string;
          emoji: string | null;
          id: number;
          kg_por_cesta: number | null;
          modo_pesaje: string;
          nombre: string;
          notas: string | null;
          stock_minimo: number;
          tipo: Database["public"]["Enums"]["tipo_producto"];
          unidad: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          categoria?: string;
          codigo: number;
          created_at?: string;
          emoji?: string | null;
          id?: never;
          kg_por_cesta?: number | null;
          modo_pesaje?: string;
          nombre: string;
          notas?: string | null;
          stock_minimo?: number;
          tipo?: Database["public"]["Enums"]["tipo_producto"];
          unidad?: string;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          categoria?: string;
          codigo?: number;
          created_at?: string;
          emoji?: string | null;
          id?: never;
          kg_por_cesta?: number | null;
          modo_pesaje?: string;
          nombre?: string;
          notas?: string | null;
          stock_minimo?: number;
          tipo?: Database["public"]["Enums"]["tipo_producto"];
          unidad?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "productos_unidad_fkey";
            columns: ["unidad"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["codigo"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          debe_cambiar_clave: boolean;
          email: string;
          estado: Database["public"]["Enums"]["estado_usuario"];
          id: string;
          nombre: string;
          rol: Database["public"]["Enums"]["rol_usuario"];
          ultimo_acceso: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          debe_cambiar_clave?: boolean;
          email: string;
          estado?: Database["public"]["Enums"]["estado_usuario"];
          id: string;
          nombre?: string;
          rol?: Database["public"]["Enums"]["rol_usuario"];
          ultimo_acceso?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          debe_cambiar_clave?: boolean;
          email?: string;
          estado?: Database["public"]["Enums"]["estado_usuario"];
          id?: string;
          nombre?: string;
          rol?: Database["public"]["Enums"]["rol_usuario"];
          ultimo_acceso?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      proveedores: {
        Row: {
          activo: boolean;
          created_at: string;
          created_by: string | null;
          documento: string | null;
          id: number;
          moneda_habitual: string;
          nombre: string;
          notas: string | null;
          search: string | null;
          telefono: string | null;
          tipo: string;
          ubicacion: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          created_at?: string;
          created_by?: string | null;
          documento?: string | null;
          id?: never;
          moneda_habitual?: string;
          nombre: string;
          notas?: string | null;
          search?: never;
          telefono?: string | null;
          tipo?: string;
          ubicacion?: string | null;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          created_at?: string;
          created_by?: string | null;
          documento?: string | null;
          id?: never;
          moneda_habitual?: string;
          nombre?: string;
          notas?: string | null;
          search?: never;
          telefono?: string | null;
          tipo?: string;
          ubicacion?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proveedores_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proveedores_moneda_habitual_fkey";
            columns: ["moneda_habitual"];
            isOneToOne: false;
            referencedRelation: "monedas";
            referencedColumns: ["codigo"];
          },
        ];
      };
      tareas_nomina: {
        Row: {
          activa: boolean;
          codigo: string | null;
          emoji: string | null;
          id: number;
          nombre: string;
          orden: number;
          unidad: string;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          activa?: boolean;
          codigo?: string | null;
          emoji?: string | null;
          id?: never;
          nombre: string;
          orden?: number;
          unidad?: string;
          valor: number;
        };
        Update: {
          activa?: boolean;
          codigo?: string | null;
          emoji?: string | null;
          id?: never;
          nombre?: string;
          orden?: number;
          unidad?: string;
          valor?: number;
        };
        Relationships: [];
      };
      tasas_cambio: {
        Row: {
          created_at: string;
          created_by: string | null;
          fecha: string;
          id: number;
          moneda_destino: string;
          moneda_origen: string;
          nota: string | null;
          tasa: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          fecha: string;
          id?: never;
          moneda_destino: string;
          moneda_origen: string;
          nota?: string | null;
          tasa: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          fecha?: string;
          id?: never;
          moneda_destino?: string;
          moneda_origen?: string;
          nota?: string | null;
          tasa?: number;
        };
        Relationships: [
          {
            foreignKeyName: "tasas_cambio_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasas_cambio_moneda_destino_fkey";
            columns: ["moneda_destino"];
            isOneToOne: false;
            referencedRelation: "monedas";
            referencedColumns: ["codigo"];
          },
          {
            foreignKeyName: "tasas_cambio_moneda_origen_fkey";
            columns: ["moneda_origen"];
            isOneToOne: false;
            referencedRelation: "monedas";
            referencedColumns: ["codigo"];
          },
        ];
      };
      ubicaciones: {
        Row: {
          activa: boolean;
          created_at: string;
          descripcion: string | null;
          es_cuarto_frio: boolean;
          id: number;
          nombre: string;
          predeterminada: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activa?: boolean;
          created_at?: string;
          descripcion?: string | null;
          es_cuarto_frio?: boolean;
          id?: never;
          nombre: string;
          predeterminada?: boolean;
          updated_at?: string;
        };
        Update: {
          activa?: boolean;
          created_at?: string;
          descripcion?: string | null;
          es_cuarto_frio?: boolean;
          id?: never;
          nombre?: string;
          predeterminada?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      unidades: {
        Row: {
          activa: boolean;
          codigo: string;
          nombre: string;
          plural: string;
        };
        ComputedFields: never;
        Insert: {
          activa?: boolean;
          codigo: string;
          nombre: string;
          plural: string;
        };
        Update: {
          activa?: boolean;
          codigo?: string;
          nombre?: string;
          plural?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_resumen_clientes: {
        Row: {
          activo: boolean | null;
          cajas_devueltas: number | null;
          cajas_pendientes: number | null;
          cajas_retiradas: number | null;
          documento: string | null;
          estado: string | null;
          facturas_pendientes: number | null;
          id: number | null;
          letra: string | null;
          moneda: string | null;
          nombre: string | null;
          numero: number | null;
          pendiente_desde: string | null;
          saldo_cop: number | null;
          saldo_usd: number | null;
          saldo_ves: number | null;
          search: string | null;
          telefono: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      v_resumen_empleados: {
        Row: {
          abonos: number | null;
          activo: boolean | null;
          cargo: string | null;
          cedula: string | null;
          codigo: string | null;
          ganado: number | null;
          id: number | null;
          jornadas: number | null;
          letra: string | null;
          n_abonos: number | null;
          nombre: string | null;
          saldo_neto: number | null;
          search: string | null;
          tarifa_dia: number | null;
          tipo: Database["public"]["Enums"]["tipo_empleado"] | null;
          ultima_jornada: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      v_resumen_proveedores: {
        Row: {
          activo: boolean | null;
          cestas_devueltas: number | null;
          cestas_entregadas: number | null;
          cestas_pendientes: number | null;
          con_saldo: boolean | null;
          documento: string | null;
          id: number | null;
          letra: string | null;
          moneda_habitual: string | null;
          nombre: string | null;
          saldo_cop: number | null;
          saldo_usd: number | null;
          saldo_ves: number | null;
          search: string | null;
          telefono: string | null;
          tipo: string | null;
          ubicacion: string | null;
          ultima_entrega: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "proveedores_moneda_habitual_fkey";
            columns: ["moneda_habitual"];
            isOneToOne: false;
            referencedRelation: "monedas";
            referencedColumns: ["codigo"];
          },
        ];
      };
      v_saldos_clientes_moneda: {
        Row: {
          cliente_id: number | null;
          facturado: number | null;
          facturas_pendientes: number | null;
          moneda: string | null;
          pendiente_desde: string | null;
          pendiente_facturas: number | null;
          recibido: number | null;
          saldo: number | null;
          saldo_a_favor: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      v_saldos_proveedores_moneda: {
        Row: {
          kg_total: number | null;
          merma: number | null;
          moneda: string | null;
          n_abonos: number | null;
          n_entregas: number | null;
          peso_neto: number | null;
          proveedor_id: number | null;
          saldo: number | null;
          total_abonos: number | null;
          total_entregas: number | null;
          ultima_entrega: string | null;
          ultimo_abono: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      v_stock: {
        Row: {
          cantidad: number | null;
          codigo: number | null;
          emoji: string | null;
          forma: Database["public"]["Enums"]["forma_inventario"] | null;
          indicador: string | null;
          nombre: string | null;
          producto_id: number | null;
          stock_minimo: number | null;
          tipo: Database["public"]["Enums"]["tipo_producto"] | null;
          ubicacion: string | null;
          ubicacion_id: number | null;
          unidad: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "productos_unidad_fkey";
            columns: ["unidad"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["codigo"];
          },
        ];
      };
      v_stock_total: {
        Row: {
          activo: boolean | null;
          codigo: number | null;
          emoji: string | null;
          indicador: string | null;
          nombre: string | null;
          producto_id: number | null;
          stock_minimo: number | null;
          stock_mp: number | null;
          stock_pt: number | null;
          tipo: Database["public"]["Enums"]["tipo_producto"] | null;
          unidad: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "productos_unidad_fkey";
            columns: ["unidad"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["codigo"];
          },
        ];
      };
    };
    Functions: {
      _anular_factura_base: { Args: { p_id: number; p_motivo: string }; Returns: Json };
      _editar_factura_base: { Args: { p: Json }; Returns: Json };
      _editar_factura_externa_base: { Args: { p: Json }; Returns: undefined };
      _editar_pago_cliente_base: { Args: { p: Json; p_id: number }; Returns: Json };
      _eliminar_pago_cliente_base: { Args: { p_id: number }; Returns: undefined };
      _emitir_factura_base: { Args: { p: Json }; Returns: Json };
      _registrar_factura_externa_base: { Args: { p: Json }; Returns: number };
      _registrar_pago_cliente_base: { Args: { p: Json }; Returns: Json };
      ajustar_inventario: {
        Args: {
          p_conteo: number;
          p_forma: Database["public"]["Enums"]["forma_inventario"];
          p_motivo: string;
          p_producto_id: number;
          p_ubicacion_id: number;
        };
        Returns: number;
      };
      antiguedad_cxc: {
        Args: { p_corte?: string; p_moneda?: string };
        Returns: {
          cliente_id: number;
          d0_15: number;
          d16_30: number;
          d31_60: number;
          d60_mas: number;
          moneda: string;
          nombre: string;
          numero: number;
          total: number;
        }[];
      };
      anular_factura: { Args: { p_id: number; p_motivo: string }; Returns: Json };
      aplicar_credito_cliente: { Args: { p_cliente_id: number }; Returns: number };
      aplicar_saldo_a_favor: { Args: { p_factura_id: number; p_monto: number }; Returns: number };
      auditar: {
        Args: {
          p_accion: string;
          p_antes?: Json;
          p_despues?: Json;
          p_nota?: string;
          p_registro_id: string;
          p_tabla: string;
        };
        Returns: undefined;
      };
      buscar_clientes: {
        Args: { p_estado?: string; p_incluir_inactivos?: boolean; p_moneda?: string; p_q?: string };
        Returns: {
          activo: boolean | null;
          cajas_devueltas: number | null;
          cajas_pendientes: number | null;
          cajas_retiradas: number | null;
          documento: string | null;
          estado: string | null;
          facturas_pendientes: number | null;
          id: number | null;
          letra: string | null;
          moneda: string | null;
          nombre: string | null;
          numero: number | null;
          pendiente_desde: string | null;
          saldo_cop: number | null;
          saldo_usd: number | null;
          saldo_ves: number | null;
          search: string | null;
          telefono: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "v_resumen_clientes";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      buscar_facturas: {
        Args: {
          p_cliente_id?: number;
          p_desde?: string;
          p_desplazamiento?: number;
          p_estado?: string;
          p_hasta?: string;
          p_limite?: number;
          p_moneda?: string;
          p_q?: string;
        };
        Returns: {
          cliente_id: number;
          cliente_nombre: string;
          cliente_numero: number;
          estado: Database["public"]["Enums"]["estado_factura"];
          estado_pago: string;
          fecha: string;
          id: number;
          moneda: string;
          numero: number;
          numero_externo: string;
          origen: Database["public"]["Enums"]["origen_factura"];
          pagado: number;
          saldo: number;
          total: number;
          version: number;
        }[];
      };
      buscar_proveedores: {
        Args: {
          p_con_saldo?: boolean;
          p_desde?: string;
          p_hasta?: string;
          p_incluir_inactivos?: boolean;
          p_moneda?: string;
          p_producto?: number;
          p_q?: string;
          p_tipo?: string;
        };
        Returns: {
          activo: boolean | null;
          cestas_devueltas: number | null;
          cestas_entregadas: number | null;
          cestas_pendientes: number | null;
          con_saldo: boolean | null;
          documento: string | null;
          id: number | null;
          letra: string | null;
          moneda_habitual: string | null;
          nombre: string | null;
          saldo_cop: number | null;
          saldo_usd: number | null;
          saldo_ves: number | null;
          search: string | null;
          telefono: string | null;
          tipo: string | null;
          ubicacion: string | null;
          ultima_entrega: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "v_resumen_proveedores";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      calcular_entrega: {
        Args: {
          p_cestas: number;
          p_kg_por_cesta: number;
          p_kg_total: number;
          p_merma: number;
          p_modo: string;
          p_precio: number;
          p_unidades: number;
        };
        Returns: Record<string, unknown>;
      };
      cerrar_periodo_nomina: {
        Args: { p_entregado_por?: string; p_liquidar?: boolean; p_periodo_id: number };
        Returns: undefined;
      };
      editar_factura: { Args: { p: Json }; Returns: Json };
      editar_factura_externa: { Args: { p: Json }; Returns: undefined };
      editar_pago_cliente: { Args: { p: Json; p_id: number }; Returns: Json };
      eliminar_pago_cliente: { Args: { p_id: number }; Returns: undefined };
      emitir_factura: { Args: { p: Json }; Returns: Json };
      empresa_publica: {
        Args: Record<PropertyKey, never>;
        Returns: {
          logo_path: string;
          razon_social: string;
        }[];
      };
      es_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      es_usuario_activo: { Args: Record<PropertyKey, never>; Returns: boolean };
      estado_cuenta_cliente: {
        Args: { p_cliente_id: number; p_desde?: string; p_hasta?: string; p_moneda: string };
        Returns: {
          abono: number;
          cargo: number;
          detalle: string;
          documento: string;
          fecha: string;
          ref_id: number;
          saldo: number;
          tipo: string;
        }[];
      };
      estado_cuenta_proveedor: {
        Args: { p_desde?: string; p_hasta?: string; p_moneda: string; p_proveedor_id: number };
        Returns: {
          abono: number;
          cargo: number;
          cestas: number;
          detalle: string;
          fecha: string;
          kg: number;
          merma: number;
          ref_id: number;
          saldo: number;
          tipo: string;
        }[];
      };
      exigir_rol: {
        Args: { roles: Database["public"]["Enums"]["rol_usuario"][] };
        Returns: undefined;
      };
      f_unaccent: { Args: { t: string }; Returns: string };
      factura_aplicar_cabecera: { Args: { p: Json; p_id: number }; Returns: undefined };
      factura_copiar_cliente: { Args: { p_id: number }; Returns: undefined };
      factura_diferencias: { Args: { p_antes: Json; p_despues: Json }; Returns: Json };
      factura_guardar_lineas: { Args: { p_id: number; p_lineas: Json }; Returns: undefined };
      factura_liberar_exceso: { Args: { p_id: number }; Returns: number };
      factura_sincronizar_inventario: { Args: { p_id: number }; Returns: Json };
      factura_snapshot: { Args: { p_id: number }; Returns: Json };
      facturas_filtradas: {
        Args: {
          p_cliente_id?: number;
          p_desde?: string;
          p_estado?: string;
          p_hasta?: string;
          p_moneda?: string;
          p_q?: string;
        };
        Returns: {
          anulada_el: string | null;
          anulada_por: string | null;
          base_imponible: number;
          cliente_direccion: string | null;
          cliente_documento: string | null;
          cliente_id: number;
          cliente_nombre: string | null;
          cliente_numero: number | null;
          cliente_telefono: string | null;
          condicion: Database["public"]["Enums"]["condicion_pago"];
          created_at: string;
          created_by: string | null;
          emitida_el: string | null;
          emitida_por: string | null;
          estado: Database["public"]["Enums"]["estado_factura"];
          estado_pago: string | null;
          exento: number;
          fecha: string;
          id: number;
          iva: number;
          iva_pct: number;
          moneda: string;
          motivo_anulacion: string | null;
          numero: number | null;
          numero_externo: string | null;
          observaciones: string | null;
          origen: Database["public"]["Enums"]["origen_factura"];
          pagado: number;
          saldo: number | null;
          soporte_path: string | null;
          soporte_url: string | null;
          subtotal: number;
          total: number;
          ubicacion_id: number | null;
          updated_at: string;
          version: number;
        }[];
        SetofOptions: {
          from: "*";
          to: "facturas";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      fecha_en_periodo_cerrado: { Args: { p_fecha: string }; Returns: boolean };
      forma_compra: {
        Args: { p_producto_id: number };
        Returns: Database["public"]["Enums"]["forma_inventario"];
      };
      forma_venta: {
        Args: { p_producto_id: number };
        Returns: Database["public"]["Enums"]["forma_inventario"];
      };
      guardar_borrador_factura: { Args: { p: Json }; Returns: number };
      guardar_jornada: { Args: { p: Json }; Returns: number };
      hoy: { Args: Record<PropertyKey, never>; Returns: string };
      inv_ajustar_factura: {
        Args: {
          p_factura_id: number;
          p_nota?: string;
          p_objetivo: number;
          p_producto_id: number;
          p_ubicacion_id: number;
        };
        Returns: undefined;
      };
      inv_salida: {
        Args: {
          p_cantidad: number;
          p_entrega_id?: number;
          p_factura_id?: number;
          p_fecha?: string;
          p_forma: Database["public"]["Enums"]["forma_inventario"];
          p_nota?: string;
          p_produccion_id?: number;
          p_producto_id: number;
          p_tipo: Database["public"]["Enums"]["tipo_movimiento"];
          p_traslado_id?: string;
          p_ubicacion_id: number;
        };
        Returns: undefined;
      };
      kardex: {
        Args: {
          p_desde?: string;
          p_forma?: Database["public"]["Enums"]["forma_inventario"];
          p_hasta?: string;
          p_producto_id: number;
          p_ubicacion_id?: number;
        };
        Returns: {
          entrada: number;
          fecha: string;
          forma: Database["public"]["Enums"]["forma_inventario"];
          id: number;
          nota: string;
          referencia: string;
          saldo: number;
          salida: number;
          tipo: Database["public"]["Enums"]["tipo_movimiento"];
          ubicacion: string;
          usuario: string;
        }[];
      };
      kpis_clientes: { Args: Record<PropertyKey, never>; Returns: Json };
      kpis_proveedores: { Args: Record<PropertyKey, never>; Returns: Json };
      normalizar: { Args: { t: string }; Returns: string };
      puede_editar_facturas: { Args: Record<PropertyKey, never>; Returns: boolean };
      reabrir_periodo_nomina: {
        Args: { p_motivo: string; p_periodo_id: number };
        Returns: undefined;
      };
      recalcular_pagado: { Args: { p_factura_id: number }; Returns: undefined };
      registrar_acceso: { Args: Record<PropertyKey, never>; Returns: undefined };
      registrar_factura_externa: { Args: { p: Json }; Returns: number };
      registrar_merma_inventario: {
        Args: {
          p_cantidad: number;
          p_forma: Database["public"]["Enums"]["forma_inventario"];
          p_motivo: string;
          p_producto_id: number;
          p_ubicacion_id: number;
        };
        Returns: undefined;
      };
      registrar_pago_cliente: { Args: { p: Json }; Returns: Json };
      registrar_produccion: {
        Args: {
          p_fecha: string;
          p_items: Json;
          p_nota?: string;
          p_responsable?: string;
          p_ubicacion_id: number;
        };
        Returns: number;
      };
      registrar_version_factura: {
        Args: { p_accion: string; p_antes: Json; p_id: number; p_motivo: string };
        Returns: undefined;
      };
      rol_actual: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["rol_usuario"];
      };
      saldo_a_favor: { Args: { p_cliente_id: number; p_moneda: string }; Returns: number };
      siguiente_numero: { Args: { p_clave: string }; Returns: number };
      siguiente_numero_factura: { Args: Record<PropertyKey, never>; Returns: number };
      stock_disponible: {
        Args: {
          p_forma?: Database["public"]["Enums"]["forma_inventario"];
          p_producto_id: number;
          p_ubicacion_id?: number;
        };
        Returns: number;
      };
      tasa_en: { Args: { p_destino: string; p_fecha?: string; p_origen: string }; Returns: number };
      tiene_rol: {
        Args: { roles: Database["public"]["Enums"]["rol_usuario"][] };
        Returns: boolean;
      };
      totales_facturas: {
        Args: {
          p_cliente_id?: number;
          p_desde?: string;
          p_estado?: string;
          p_hasta?: string;
          p_moneda?: string;
          p_q?: string;
        };
        Returns: {
          anuladas: number;
          cantidad: number;
          moneda: string;
          pagado: number;
          saldo: number;
          total: number;
        }[];
      };
      trasladar_inventario: {
        Args: {
          p_cantidad: number;
          p_destino: number;
          p_forma: Database["public"]["Enums"]["forma_inventario"];
          p_nota?: string;
          p_origen: number;
          p_producto_id: number;
        };
        Returns: string;
      };
      ubicacion_predeterminada: { Args: Record<PropertyKey, never>; Returns: number };
      ultimo_precio: {
        Args: { p_cliente_id: number; p_moneda: string; p_producto_id: number };
        Returns: number;
      };
      ultimos_precios_cliente: {
        Args: { p_cliente_id: number; p_moneda: string };
        Returns: {
          fecha: string;
          precio: number;
          producto_id: number;
        }[];
      };
    };
    Enums: {
      condicion_pago: "contado" | "credito";
      estado_factura: "borrador" | "emitida" | "anulada";
      estado_jornada: "asistio" | "media" | "produccion" | "no";
      estado_usuario: "ACTIVO" | "BLOQUEADO" | "INACTIVO";
      forma_inventario: "MP" | "PT";
      origen_factura: "sistema" | "externa";
      rol_usuario: "admin" | "facturacion" | "operador" | "solo_lectura";
      tipo_empleado: "fijo" | "destajo";
      tipo_movimiento:
        | "produccion"
        | "consumo_produccion"
        | "compra"
        | "venta"
        | "reverso_venta"
        | "merma"
        | "ajuste"
        | "traslado_salida"
        | "traslado_entrada"
        | "inicial";
      tipo_pago_cliente: "pago" | "conversion";
      tipo_producto: "materia_prima" | "terminado" | "ambos";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      condicion_pago: ["contado", "credito"],
      estado_factura: ["borrador", "emitida", "anulada"],
      estado_jornada: ["asistio", "media", "produccion", "no"],
      estado_usuario: ["ACTIVO", "BLOQUEADO", "INACTIVO"],
      forma_inventario: ["MP", "PT"],
      origen_factura: ["sistema", "externa"],
      rol_usuario: ["admin", "facturacion", "operador", "solo_lectura"],
      tipo_empleado: ["fijo", "destajo"],
      tipo_movimiento: [
        "produccion",
        "consumo_produccion",
        "compra",
        "venta",
        "reverso_venta",
        "merma",
        "ajuste",
        "traslado_salida",
        "traslado_entrada",
        "inicial",
      ],
      tipo_pago_cliente: ["pago", "conversion"],
      tipo_producto: ["materia_prima", "terminado", "ambos"],
    },
  },
} as const;
