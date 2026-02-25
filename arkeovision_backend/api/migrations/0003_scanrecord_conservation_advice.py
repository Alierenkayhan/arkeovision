from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_scanrecord_design_3d_image'),
    ]

    operations = [
        migrations.AddField(
            model_name='scanrecord',
            name='conservation_advice',
            field=models.TextField(blank=True, default=''),
            preserve_default=False,
        ),
    ]
